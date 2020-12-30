/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { WriteInfo } from '../types';
import { BaseMetadataTransformer } from './baseMetadataTransformer';
import { DecompositionStrategy, SourceComponent } from '../../metadata-registry';
import { JsonArray } from '@salesforce/ts-types';
import { JsToXml } from '../streams';
import { join } from 'path';
import {
  SourcePath,
  META_XML_SUFFIX,
  XML_NS_URL,
  XML_NS_KEY,
  MetadataComponent,
} from '../../common';
import { ComponentSet } from '../../collections';
import { DecompositionState } from '../convertContext';

export class DecomposedMetadataTransformer extends BaseMetadataTransformer {
  public async toMetadataFormat(component: SourceComponent): Promise<WriteInfo[]> {
    if (component.parent) {
      const { fullName: parentName } = component.parent;
      this.context.recomposition.setState((state) => {
        if (state[parentName]) {
          state[parentName].children.push(component);
        } else {
          state[parentName] = {
            component: component.parent,
            children: [component],
          };
        }
      });
    } else {
      const { fullName } = component;
      this.context.recomposition.setState((state) => {
        if (state[fullName]) {
          state[fullName].children.push(...component.getChildren());
        } else {
          state[fullName] = {
            component,
            children: component.getChildren(),
          };
        }
      });
    }
    // noop since the finalizer will push the writes to the component writer
    return [];
  }

  public async toSourceFormat(
    component: SourceComponent,
    mergeWith?: SourceComponent
  ): Promise<WriteInfo[]> {
    const writeInfos: WriteInfo[] = [];
    const { type, fullName: parentFullName } = component;

    const mergeWithChildren = mergeWith ? new ComponentSet(mergeWith.getChildren()) : undefined;
    let parentXmlObject: any;
    const composedMetadata = await this.getComposedMetadataEntries(component);

    // if (mergeWith) {
    //   this.setDecomposedState(component);
    // }

    for (const [tagKey, tagValue] of composedMetadata) {
      const childTypeId = type.children?.directories[tagKey];
      if (childTypeId) {
        const childType = type.children.types[childTypeId];
        const tagValues = Array.isArray(tagValue) ? tagValue : [tagValue];
        for (const value of tagValues) {
          const entryName = (value.fullName || value.name) as string;
          const childComponent: MetadataComponent = {
            fullName: `${parentFullName}.${entryName}`,
            type: childType,
            parent: component,
          };
          const source = new JsToXml({
            [childType.name]: Object.assign({ [XML_NS_KEY]: XML_NS_URL }, value),
          });
          if (!mergeWith) {
            writeInfos.push({
              source,
              output: this.getDefaultOutput(childComponent),
            });
          } else {
            if (mergeWithChildren.has(childComponent)) {
              const mergeChild: SourceComponent = mergeWithChildren
                .getSourceComponents(childComponent)
                .next().value;
              writeInfos.push({
                source,
                output: mergeChild.xml,
              });
              this.setDecomposedState(childComponent, { foundMerge: true });
            } else {
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
          parentXmlObject[type.name][tagKey] = tagValue as JsonArray;
        }
      }
    }

    const parentInContextState = !!this.context.decomposition.state[parentFullName];
    if (!parentInContextState && parentXmlObject) {
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
      } else {
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

  private async getComposedMetadataEntries(component: SourceComponent): Promise<[string, any][]> {
    const composedMetadata = (await component.parseXml())[component.type.name];
    return Object.entries(composedMetadata);
  }

  /**
   * Helper for setting the decomposed transaction state
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
