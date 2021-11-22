/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { join } from 'path';
import { JsonMap } from '@salesforce/ts-types';
import { MetadataComponent, SourceComponent } from '../../resolve';
import { JsToXml } from '../streams';
import { WriteInfo } from '../types';
import { META_XML_SUFFIX, SourcePath, XML_NS_KEY, XML_NS_URL } from '../../common';
import { ComponentSet } from '../../collections';
import { DecompositionState } from '../convertContext';
import { DecompositionStrategy } from '../../registry';
import { BaseMetadataTransformer } from './baseMetadataTransformer';

export class DecomposedMetadataTransformer extends BaseMetadataTransformer {
  // eslint-disable-next-line @typescript-eslint/require-await
  public async toMetadataFormat(component: SourceComponent): Promise<WriteInfo[]> {
    if (component.parent) {
      const { fullName: parentName } = component.parent;
      this.context.recomposition.setState((state) => {
        if (state[parentName]) {
          state[parentName].children.add(component);
        } else {
          state[parentName] = {
            component: component.parent,
            children: new ComponentSet([component], this.registry),
          };
        }
      });
    } else {
      const { fullName } = component;
      this.context.recomposition.setState((state) => {
        if (!state[fullName]) {
          state[fullName] = { component, children: new ComponentSet([], this.registry) };
        }
        const children = component.getChildren();
        if (children) {
          children.map((child) => {
            state[fullName].children.add(child);
          });
        }
      });
    }
    // noop since the finalizer will push the writes to the component writer
    return [];
  }

  public async toSourceFormat(component: SourceComponent, mergeWith?: SourceComponent): Promise<WriteInfo[]> {
    const writeInfos: WriteInfo[] = [];
    const childrenOfMergeComponent = new ComponentSet(mergeWith?.getChildren());
    const { type, fullName: parentFullName } = component;
    const forceIgnore = component.getForceIgnore();

    let parentXmlObject: JsonMap;
    const composedMetadata = await this.getComposedMetadataEntries(component);

    for (const [tagKey, tagValue] of composedMetadata) {
      const childTypeId = type.children?.directories[tagKey];
      if (childTypeId) {
        const childType = type.children.types[childTypeId];
        const tagValues = Array.isArray(tagValue) ? tagValue : [tagValue];
        for (const value of tagValues as [{ fullName: string; name: string }]) {
          const entryName = value.fullName || value.name;
          const childComponent: MetadataComponent = {
            fullName: `${parentFullName}.${entryName}`,
            type: childType,
            parent: component,
          };
          // only process child types that aren't forceignored
          if (forceIgnore.accepts(this.getDefaultOutput(childComponent))) {
            const source = new JsToXml({
              [childType.name]: Object.assign({ [XML_NS_KEY]: XML_NS_URL }, value),
            });
            // if there's nothing to merge with, push write operation now to default location
            if (!mergeWith) {
              writeInfos.push({
                source,
                output: this.getDefaultOutput(childComponent),
              });
            }
            // if the merge parent has a child that can be merged with, push write
            // operation now and mark it as merged in the state
            else if (childrenOfMergeComponent.has(childComponent)) {
              const mergeChild: SourceComponent = childrenOfMergeComponent.getSourceComponents(childComponent).first();
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
                  output: this.getDefaultOutput(childComponent),
                },
              });
            }
          }
        }
      } else {
        // tag entry isn't a child type, so add it to the parent xml
        if (tagKey !== XML_NS_KEY) {
          if (!parentXmlObject) {
            parentXmlObject = { [type.name]: { [XML_NS_KEY]: XML_NS_URL } };
          }
          const tagGroup = parentXmlObject[type.name] as JsonMap;
          tagGroup[tagKey] = tagValue;
        }
      }
    }

    const parentState = this.getDecomposedState(component);
    if (!parentState && parentXmlObject) {
      const parentSource = new JsToXml(parentXmlObject);
      if (!mergeWith) {
        writeInfos.push({
          source: parentSource,
          output: this.getDefaultOutput(component),
        });
      } else if (mergeWith.xml) {
        writeInfos.push({
          source: parentSource,
          output: mergeWith.xml,
        });
        this.setDecomposedState(component, { foundMerge: true });
      } else if (!parentState?.foundMerge) {
        this.setDecomposedState(component, {
          foundMerge: false,
          writeInfo: {
            source: parentSource,
            output: this.getDefaultOutput(component),
          },
        });
      }
    }

    return writeInfos;
  }

  private async getComposedMetadataEntries(
    component: SourceComponent
  ): Promise<Array<[string, { fullname?: string; name?: string }]>> {
    const composedMetadata = (await component.parseXml())[component.type.name];
    // composedMetadata might be undefined if you call toSourceFormat() from a non-source-backed Component
    return composedMetadata ? Object.entries(composedMetadata) : [];
  }

  /**
   * Helper for setting the decomposed transaction state
   *
   * @param forComponent
   * @param props
   */
  private setDecomposedState(
    forComponent: MetadataComponent,
    props: Partial<Omit<DecompositionState[keyof DecompositionState], 'origin'>> = {}
  ): void {
    const key = `${forComponent.type.name}#${forComponent.fullName}`;
    const withOrigin = Object.assign({ origin: forComponent.parent ?? forComponent }, props);
    this.context.decomposition.setState((state) => {
      state[key] = Object.assign(state[key] ?? {}, withOrigin);
    });
  }

  private getDecomposedState<T extends string>(forComponent: MetadataComponent): DecompositionState[T] {
    const key = `${forComponent.type.name}#${forComponent.fullName}`;
    return this.context.decomposition.state[key];
  }

  private getDefaultOutput(component: MetadataComponent): SourcePath {
    const { parent, fullName, type } = component;
    const [baseName, childName] = fullName.split('.');
    const baseComponent = (parent ?? component) as SourceComponent;
    let output = `${childName ?? baseName}.${component.type.suffix}${META_XML_SUFFIX}`;
    if (parent?.type.strategies.decomposition === DecompositionStrategy.FolderPerType) {
      output = join(type.directoryName, output);
    }
    return join(baseComponent.getPackageRelativePath(baseName, 'source'), output);
  }
}
