/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { dirname, join } from 'node:path';
import { AnyJson, JsonMap, ensureString, isJsonMap } from '@salesforce/ts-types';
import { ensureArray } from '@salesforce/kit';
import { Messages } from '@salesforce/core';
import { extractUniqueElementValue } from '../../utils/decomposed';
import type { MetadataComponent } from '../../resolve/types';
import { DecompositionStrategy, type MetadataType } from '../../registry/types';
import { SourceComponent } from '../../resolve/sourceComponent';
import { JsToXml } from '../streams';
import { WriteInfo } from '../types';
import { META_XML_SUFFIX, XML_NS_KEY, XML_NS_URL } from '../../common/constants';
import { SourcePath } from '../../common/types';
import { ComponentSet } from '../../collections/componentSet';
import { DecompositionStateValue } from '../convertContext/decompositionFinalizer';
import { BaseMetadataTransformer } from './baseMetadataTransformer';

type XmlObj = { [index: string]: { [XML_NS_KEY]: typeof XML_NS_URL } & JsonMap };

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

  // eslint-disable-next-line complexity
  public async toSourceFormat(component: SourceComponent, mergeWith?: SourceComponent): Promise<WriteInfo[]> {
    const outputFile = mergeWith?.xml ?? getDefaultOutput(component);
    const forceIgnore = component.getForceIgnore();

    // if the whole parent is ignored, we won't worry about decomposing things
    // this can happen if the manifest had a *; all the members will be retrieved.
    if (forceIgnore.denies(outputFile)) {
      return [];
    }

    const writeInfos: WriteInfo[] = [];
    const childrenOfMergeComponent = new ComponentSet(mergeWith?.getChildren(), this.registry);

    const composedMetadata = (await getComposedMetadataEntries(component)).map(([tagKey, tagValue]) => ({
      tagKey,
      tagValue,
      type: component.type,
      childTypeId: tagToChildTypeId({ tagKey, type: component.type }),
    }));

    const nonChildren = Object.fromEntries(
      composedMetadata
        .filter(({ childTypeId: childType }) => childType === undefined)
        .map(({ tagKey, tagValue: value }) => [tagKey, value])
    );

    const parentXmlObject: XmlObj = {
      [component.type.name]: { [XML_NS_KEY]: XML_NS_URL, ...nonChildren },
    };

    composedMetadata
      .filter(hasChildTypeId)
      .map((i) => ({ ...i, childType: component.type.children?.types[i.childTypeId] }))
      .map(hasValidType)
      .map(({ tagValue, childType }) => {
        // iterate each array member if it's Object-like (ex: customField of a CustomObject)
        ensureArray(tagValue)
          .filter(isJsonMap)
          .map(tagValueResults(component)(childType))
          // only process child types that aren't forceignored
          .filter((v) => forceIgnore.accepts(getDefaultOutput(v.childComponent)))
          .map(({ entryName, childComponent, value }) => {
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
                source: new JsToXml({
                  [childType.name]: Object.assign({ [XML_NS_KEY]: XML_NS_URL }, value),
                }),
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
                source: new JsToXml({
                  [childType.name]: Object.assign({ [XML_NS_KEY]: XML_NS_URL }, value),
                }),
                output: mergeChild.xml,
              });
              this.setDecomposedState(childComponent, { foundMerge: true });
            }
            // If we have a parent and the child is unaddressable without the parent, keep them
            // together on the file system, meaning a new child will not be written to the default dir.
            else if (childType.unaddressableWithoutParent) {
              // get output path from parent
              const childFileName = `${entryName}.${childComponent.type.suffix}${META_XML_SUFFIX}`;
              const output = join(dirname(mergeWith.xml as string), childFileName);
              writeInfos.push({
                source: new JsToXml({
                  [childType.name]: Object.assign({ [XML_NS_KEY]: XML_NS_URL }, value),
                }),
                output,
              });
            }
            // if no child component is found to merge with yet, mark it as so in
            // the state
            else if (!this.getDecomposedState(childComponent)?.foundMerge) {
              this.setDecomposedState(childComponent, {
                foundMerge: false,
                writeInfo: {
                  source: new JsToXml({
                    [childType.name]: Object.assign({ [XML_NS_KEY]: XML_NS_URL }, value),
                  }),
                  output: getDefaultOutput(childComponent),
                },
              });
            }
          });
      });

    if (!this.getDecomposedState(component) && parentXmlObject) {
      if (!mergeWith) {
        writeInfos.push({
          source: new JsToXml(parentXmlObject),
          output: outputFile,
        });
      } else if (mergeWith.xml) {
        writeInfos.push({
          source: new JsToXml(parentXmlObject),
          output: outputFile,
        });
        this.setDecomposedState(component, { foundMerge: true });
      } else if (objectHasSomeRealValues(component.type)(parentXmlObject)) {
        this.setDecomposedState(component, {
          foundMerge: false,
          writeInfo: {
            source: new JsToXml(parentXmlObject),
            output: outputFile,
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
    const key = getKey(forComponent);
    const withOrigin = Object.assign({ origin: forComponent.parent ?? forComponent }, props);
    this.context.decomposition.transactionState.set(key, {
      ...(this.context.decomposition.transactionState.get(key) ?? {}),
      ...withOrigin,
    });
  }

  private getDecomposedState(forComponent: MetadataComponent): DecompositionStateValue | undefined {
    return this.context.decomposition.transactionState.get(getKey(forComponent));
  }
}

const getKey = (component: MetadataComponent): string => `${component.type.name}#${component.fullName}`;

const getComposedMetadataEntries = async (component: SourceComponent): Promise<Array<[string, AnyJson]>> => {
  const composedMetadata = (await component.parseXml())[component.type.name];
  // composedMetadata might be undefined if you call toSourceFormat() from a non-source-backed Component
  return composedMetadata ? Object.entries(composedMetadata) : [];
};

/** where the file goes if there's nothing to merge with */
const getDefaultOutput = (component: MetadataComponent): SourcePath => {
  const { parent, fullName, type } = component;
  const [baseName, ...tail] = fullName.split('.');
  // there could be a '.' inside the child name (ex: PermissionSet.FieldPermissions.field uses Obj__c.Field__c)
  const childName = tail.length ? tail.join('.') : undefined;
  const baseComponent = (parent ?? component) as SourceComponent;
  const output = join(
    parent?.type.strategies?.decomposition === DecompositionStrategy.FolderPerType ? type.directoryName : '',
    `${childName ?? baseName}.${component.type.suffix}${META_XML_SUFFIX}`
  );
  return join(baseComponent.getPackageRelativePath(baseName, 'source'), output);
};

/** use the given xmlElementName name if it exists, otherwise use see if one matches the directories */
const tagToChildTypeId = ({ tagKey, type }: { tagKey: string; type: MetadataType }): string | undefined =>
  Object.values(type.children?.types ?? {}).find((c) => c.xmlElementName === tagKey)?.id ??
  type.children?.directories?.[tagKey];

/** if there's only an empty parent, we don't want to write it.  Ex: CustomObject: { '@_xmlns': 'http://soap.sforce.com/2006/04/metadata' } has no real values */
const objectHasSomeRealValues =
  (type: MetadataType) =>
  (obj: XmlObj): boolean =>
    Object.keys(obj[type.name]).length > 1;

const hasChildTypeId = (cm: ComposedMetadata): cm is ComposedMetadata & { childTypeId: string } => !!cm.childTypeId;

const hasValidType = (cm: ComposedMetadataWithOptionalChildType): ComposedMetadataWithChildType => {
  if (cm.childType) {
    return cm as ComposedMetadataWithChildType;
  }
  throw messages.createError('error_missing_child_type_definition', [cm.type.name, cm.childTypeId]);
};

type ComposedMetadata = { tagKey: string; tagValue: AnyJson; type: MetadataType; childTypeId?: string };
type ComposedMetadataWithOptionalChildType = ComposedMetadata & { childType?: MetadataType };
type ComposedMetadataWithChildType = ComposedMetadata & { childType: MetadataType };

const tagValueResults =
  (parent: SourceComponent) =>
  (childType: MetadataType) =>
  (tagValue: JsonMap): { entryName?: string; childComponent: MetadataComponent; value: JsonMap } => {
    const entryName = ensureString(extractUniqueElementValue(tagValue, childType.uniqueIdElement));
    return {
      entryName,
      childComponent: {
        fullName: `${parent.fullName}.${entryName}`,
        type: childType,
        parent,
      },
      value: tagValue,
    };
  };
