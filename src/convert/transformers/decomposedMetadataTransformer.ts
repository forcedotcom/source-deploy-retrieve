/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { WriteInfo } from '../types';
import { BaseMetadataTransformer } from './baseMetadataTransformer';
import {
  RecompositionFinalizer,
  ConvertTransaction,
  DecompositionFinalizer,
  ConvertTransactionState,
} from '../convertTransaction';
import { DecompositionStrategy, RegistryAccess, SourceComponent } from '../../metadata-registry';
import { JsonArray } from '@salesforce/ts-types';
import { JsToXml } from '../streams';
import { join } from 'path';
import {
  MetadataType,
  SourcePath,
  META_XML_SUFFIX,
  XML_NS_URL,
  XML_NS_KEY,
  MetadataComponent,
} from '../../common';
import { ComponentSet } from '../../collections';
import { threadId } from 'worker_threads';

export class DecomposedMetadataTransformer extends BaseMetadataTransformer {
  constructor(registry = new RegistryAccess(), convertTransaction = new ConvertTransaction()) {
    super(registry, convertTransaction);
    this.convertTransaction.addFinalizer(RecompositionFinalizer);
    this.convertTransaction.addFinalizer(DecompositionFinalizer);
  }

  public async toMetadataFormat(component: SourceComponent): Promise<WriteInfo[]> {
    const { state } = this.convertTransaction;
    if (component.parent) {
      const { fullName: parentName } = component.parent;
      if (!state.recompose[parentName]) {
        state.recompose[parentName] = {
          component: component.parent,
          children: [],
        };
      }
      state.recompose[parentName].children.push(component);
    } else {
      if (!state.recompose[component.fullName]) {
        state.recompose[component.fullName] = {
          component,
          children: [],
        };
      }
      state.recompose[component.fullName].children.push(...component.getChildren());
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

    const createParentXml = !this.getDecomposedTransactionState(parentFullName);
    if (mergeWith) {
      this.setDecomposedTransactionState(component);
    }

    const rootPackagePath = component.getPackageRelativePath(parentFullName, 'source');
    const mergeWithChildren = mergeWith ? new ComponentSet(mergeWith.getChildren()) : undefined;
    const parentXmlObject: any = { [type.name]: { [XML_NS_KEY]: XML_NS_URL } };
    const composedMetadata = await this.getComposedMetadataEntries(component);

    for (const [tagKey, tagValue] of composedMetadata) {
      const childTypeId = type.children?.directories[tagKey];
      if (childTypeId) {
        const childType = type.children.types[childTypeId];
        const tagValues = Array.isArray(tagValue) ? tagValue : [tagValue];
        for (const value of tagValues) {
          const entryName = (value.fullName || value.name) as string;
          const childComponent = {
            fullName: `${parentFullName}.${entryName}`,
            type: childType,
          };
          const source = new JsToXml({
            [childType.name]: Object.assign({ [XML_NS_KEY]: XML_NS_URL }, value),
          });
          if (!mergeWith) {
            writeInfos.push({
              source,
              output: join(
                rootPackagePath,
                this.getOutputPathForEntry(entryName, childType, component)
              ),
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
              this.setDecomposedTransactionState(childComponent, { foundMerge: true });
            } else {
              this.setDecomposedTransactionState(childComponent, {
                writeInfo: {
                  source,
                  output: join(
                    rootPackagePath,
                    this.getOutputPathForEntry(entryName, childType, component)
                  ),
                },
              });
            }
          }
        }
      } else {
        // tag entry isn't a child type, so add it to the parent xml
        if (createParentXml && tagKey !== XML_NS_KEY) {
          parentXmlObject[type.name][tagKey] = tagValue as JsonArray;
        }
      }
    }

    if (createParentXml) {
      const parentSource = new JsToXml(parentXmlObject);
      if (!mergeWith) {
        writeInfos.push({
          source: parentSource,
          output: join(rootPackagePath, `${parentFullName}.${type.suffix}${META_XML_SUFFIX}`),
        });
      } else if (mergeWith.xml) {
        writeInfos.push({
          source: parentSource,
          output: mergeWith.xml,
        });
        this.setDecomposedTransactionState(component, { foundMerge: true });
      } else {
        this.setDecomposedTransactionState(component, {
          writeInfo: {
            source: parentSource,
            output: join(rootPackagePath, `${parentFullName}.${type.suffix}${META_XML_SUFFIX}`),
          },
        });
      }
    }

    return writeInfos;
  }

  private getDecomposedTransactionState(
    fullName: string
  ): ConvertTransactionState['decompose'][keyof ConvertTransactionState['decompose']] | undefined {
    return this.convertTransaction.state.decompose[fullName];
  }

  private setDecomposedTransactionState(
    forComponent: MetadataComponent,
    props?: Partial<
      ConvertTransactionState['decompose'][keyof ConvertTransactionState['decompose']]
    >
  ): void {
    const { fullName } = forComponent;
    let state = this.getDecomposedTransactionState(fullName);
    if (!state) {
      state = {
        component: forComponent,
        foundMerge: false,
      };
    }
    this.convertTransaction.state.decompose[fullName] = Object.assign(state, props ?? {});
  }

  private async getComposedMetadataEntries(component: SourceComponent): Promise<[string, any][]> {
    const composedMetadata = (await component.parseXml())[component.type.name];
    return Object.entries(composedMetadata);
  }

  private getOutputPathForEntry(
    entryName: string,
    entryType: MetadataType,
    component: SourceComponent
  ): SourcePath {
    let output = `${entryName}.${entryType.suffix}${META_XML_SUFFIX}`;

    if (component.type.strategies.decomposition === DecompositionStrategy.FolderPerType) {
      output = join(entryType.directoryName, output);
    }

    return output;
  }
}
