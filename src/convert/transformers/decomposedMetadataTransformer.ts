/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { join } from 'path';
import { JsonMap } from '@salesforce/ts-types';
import { ensureArray } from '@salesforce/kit';
import { Messages } from '@salesforce/core';
import { MetadataComponent, SourceComponent } from '../../resolve';
import { JsToXml } from '../streams';
import { WriteInfo } from '../types';
import { META_XML_SUFFIX, SourcePath, XML_NS_KEY, XML_NS_URL } from '../../common';
import { ComponentSet } from '../../collections';
import { DecompositionStateValue } from '../convertContext';
import { DecompositionStrategy } from '../../registry';
import { BaseMetadataTransformer } from './baseMetadataTransformer';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/source-deploy-retrieve', 'sdr');
export class DecomposedMetadataTransformer extends BaseMetadataTransformer {
  // eslint-disable-next-line @typescript-eslint/require-await
  public async toMetadataFormat(component: SourceComponent): Promise<WriteInfo[]> {
    if (component.parent) {
      const { fullName: parentName } = component.parent;
      const stateForParent = this.context.recomposition.transactionState.get(parentName) ?? {
        component: component.parent,
        children: new ComponentSet([], this.registry),
      };
      stateForParent.children?.add(component);
      this.context.recomposition.transactionState.set(parentName, stateForParent);
    } else {
      const { fullName } = component;
      const existing = this.context.recomposition.transactionState.get(fullName) ?? {
        component,
        children: new ComponentSet([], this.registry),
      };
      (component.getChildren() ?? []).map((child) => {
        existing.children?.add(child);
      });
      this.context.recomposition.transactionState.set(fullName, existing);
    }
    // noop since the finalizer will push the writes to the component writer
    return [];
  }

  public async toSourceFormat(component: SourceComponent, mergeWith?: SourceComponent): Promise<WriteInfo[]> {
    const writeInfos: WriteInfo[] = [];
    const childrenOfMergeComponent = new ComponentSet(mergeWith?.getChildren());
    const { type, fullName: parentFullName } = component;
    const forceIgnore = component.getForceIgnore();

    let parentXmlObject: JsonMap | undefined;
    const composedMetadata = await getComposedMetadataEntries(component);

    for (const [tagKey, tagValue] of composedMetadata) {
      const childTypeId = type.children?.directories?.[tagKey];
      if (childTypeId) {
        const childType = type.children?.types[childTypeId];
        if (!childType) {
          throw messages.createError('error_missing_child_type_definition', [type.name, childTypeId]);
        }
        const tagValues = ensureArray(tagValue);
        for (const value of tagValues as [{ fullName: string; name: string }]) {
          const entryName = value.fullName || value.name;
          const childComponent: MetadataComponent = {
            fullName: `${parentFullName}.${entryName}`,
            type: childType,
            parent: component,
          };
          // only process child types that aren't forceignored
          if (forceIgnore.accepts(getDefaultOutput(childComponent))) {
            const source = new JsToXml({
              [childType.name]: Object.assign({ [XML_NS_KEY]: XML_NS_URL }, value),
            });

            /*
             composedMetadata is a representation of the parent's xml
             if there is no CustomObjectTranslation in the org, the composedMetadata will be 2 entries
             the xml declaration, and a fields attribute, which points to the child CustomObjectFieldTranslation
             because CustomObjectFieldTranslation is the only metadata type with 'requiresParent' = true we can
             calculate if a CustomObjectTranslation was retrieved from the org (composedMetadata.length > 2), or,
             if we'll have to write an empty CustomObjectTranslation file (composedMetadata.length <=2).
             CustomObjectFieldTranslations are only addressable through their parent, and require a
             CustomObjectTranslation file to be present
             */
            if (childType.unaddressableWithoutParent && composedMetadata.length <= 2) {
              parentXmlObject = {
                [component.type.name]: '',
              };
              this.setDecomposedState(childComponent, {
                foundMerge: false,
                writeInfo: {
                  source: new JsToXml(parentXmlObject),
                  output: getDefaultOutput(component),
                },
              });
            }

            // if there's nothing to merge with, push write operation now to default location
            if (!mergeWith) {
              writeInfos.push({
                source,
                output: getDefaultOutput(childComponent),
              });
            }
            // if the merge parent has a child that can be merged with, push write
            // operation now and mark it as merged in the state
            else if (childrenOfMergeComponent.has(childComponent)) {
              const mergeChild = childrenOfMergeComponent.getSourceComponents(childComponent).first();
              if (!mergeChild?.xml) {
                throw messages.createError('error_parsing_xml', [childComponent.fullName, childComponent.type.name]);
              }
              writeInfos.push({
                source,
                output: mergeChild.xml,
              });
              this.setDecomposedState(childComponent, { foundMerge: true });
            }
            // if no child component is found to merge with yet, mark it as so in
            // the state
            else if (!this.getDecomposedState(childComponent)?.foundMerge) {
              this.setDecomposedState(childComponent, {
                foundMerge: false,
                writeInfo: {
                  source,
                  output: getDefaultOutput(childComponent),
                },
              });
            }
          }
        }
      } else if (tagKey !== XML_NS_KEY) {
        // tag entry isn't a child type, so add it to the parent xml
        if (!parentXmlObject) {
          parentXmlObject = { [type.name]: { [XML_NS_KEY]: XML_NS_URL } };
        }
        const tagGroup = parentXmlObject[type.name] as JsonMap;
        tagGroup[tagKey] = tagValue;
      }
    }

    const parentState = this.getDecomposedState(component);
    if (!parentState && parentXmlObject) {
      const parentSource = new JsToXml(parentXmlObject);
      if (!mergeWith) {
        writeInfos.push({
          source: parentSource,
          output: getDefaultOutput(component),
        });
      } else if (mergeWith.xml) {
        writeInfos.push({
          source: parentSource,
          output: mergeWith.xml,
        });
        this.setDecomposedState(component, { foundMerge: true });
      } else {
        this.setDecomposedState(component, {
          foundMerge: false,
          writeInfo: {
            source: parentSource,
            output: getDefaultOutput(component),
          },
        });
      }
    }

    return writeInfos;
  }

  /**
   * Helper for setting the decomposed transaction state
   *
   * @param forComponent
   * @param props
   */
  private setDecomposedState(
    forComponent: MetadataComponent,
    props: Partial<Omit<DecompositionStateValue, 'origin'>> = {}
  ): void {
    const key = `${forComponent.type.name}#${forComponent.fullName}`;
    const withOrigin = Object.assign({ origin: forComponent.parent ?? forComponent }, props);
    this.context.decomposition.transactionState.set(key, {
      ...(this.context.decomposition.transactionState.get(key) ?? {}),
      ...withOrigin,
    });
  }

  private getDecomposedState(forComponent: MetadataComponent): DecompositionStateValue | undefined {
    const key = `${forComponent.type.name}#${forComponent.fullName}`;
    return this.context.decomposition.transactionState.get(key);
  }
}

const getComposedMetadataEntries = async (
  component: SourceComponent
): Promise<Array<[string, { fullname?: string; name?: string }]>> => {
  const composedMetadata = (await component.parseXml())[component.type.name];
  // composedMetadata might be undefined if you call toSourceFormat() from a non-source-backed Component
  return composedMetadata ? Object.entries(composedMetadata) : [];
};

const getDefaultOutput = (component: MetadataComponent): SourcePath => {
  const { parent, fullName, type } = component;
  const [baseName, childName] = fullName.split('.');
  const baseComponent = (parent ?? component) as SourceComponent;
  let output = `${childName ?? baseName}.${component.type.suffix}${META_XML_SUFFIX}`;
  if (parent?.type.strategies?.decomposition === DecompositionStrategy.FolderPerType) {
    output = join(type.directoryName, output);
  }
  return join(baseComponent.getPackageRelativePath(baseName, 'source'), output);
};
