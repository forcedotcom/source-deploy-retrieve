/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { WriteInfo, WriterFormat } from './types';
import { DecompositionStrategy, SourceComponent } from '../metadata-registry';
import { join } from 'path';
import { JsToXml } from './streams';
import { MetadataComponent, META_XML_SUFFIX, XML_NS_URL } from '../common';
import { JsonArray, JsonMap } from '@salesforce/ts-types';

/**
 * Logic to execute at the end of a convert transaction
 */
export interface ConvertTransactionFinalizer {
  finalize(state: ConvertTransactionState): Promise<WriterFormat | WriterFormat[]>;
}

export interface FinalizerConstructor {
  new (): ConvertTransactionFinalizer;
}

export interface ConvertTransactionState {
  recompose: {
    [fullName: string]: {
      /**
       * Parent component that children are rolled up into
       */
      component: SourceComponent;
      /**
       * Children to be rolled up into the parent file
       */
      children: SourceComponent[];
    };
  };
  decompose: {
    [fullName: string]: {
      /**
       * Whether or not the child component found a matching component to merge with
       */
      foundMerge?: boolean;
      writeInfo?: WriteInfo;
      component: MetadataComponent;
    };
  };
}

/**
 * Manages a "global" state over the course of a single metadata conversion call.
 */
export class ConvertTransaction {
  public readonly state: ConvertTransactionState = { recompose: {}, decompose: {} };
  private readonly finalizers = new Map<string, ConvertTransactionFinalizer>();

  public addFinalizer(finalizerCtor: FinalizerConstructor): void {
    if (!this.finalizers.has(finalizerCtor.name)) {
      this.finalizers.set(finalizerCtor.name, new finalizerCtor());
    }
  }

  /**
   * Call right before the end of a conversion pipeline to execute logic with
   * the transaction state.
   */
  public async *executeFinalizers(): AsyncIterable<WriterFormat | WriterFormat[]> {
    for (const finalizer of this.finalizers.values()) {
      yield await finalizer.finalize(this.state);
    }
  }
}

/**
 * Merges child components that share the same parent in the conversion pipeline
 * into a single file.
 */
export class RecompositionFinalizer implements ConvertTransactionFinalizer {
  public async finalize(state: ConvertTransactionState): Promise<WriterFormat[]> {
    const writerData: WriterFormat[] = [];

    for (const parentName of Object.keys(state.recompose)) {
      const parent = state.recompose[parentName].component;
      const children = state.recompose[parentName].children;
      const baseObject: JsonMap = parent.xml ? await parent.parseXml() : {};
      const recomposedXmlObj = await this.recompose(children, baseObject);
      writerData.push({
        component: parent,
        writeInfos: [
          {
            source: new JsToXml(recomposedXmlObj),
            output: join(parent.type.directoryName, `${parent.fullName}.${parent.type.suffix}`),
          },
        ],
      });
    }

    return writerData;
  }

  private async recompose(children: SourceComponent[], baseXmlObj: any): Promise<JsonMap> {
    for (const child of children) {
      const { directoryName: groupNode } = child.type;
      const { name: parentName } = child.parent.type;
      const childContents = (await child.parseXml())[child.type.name];
      if (!baseXmlObj[parentName]) {
        baseXmlObj[parentName] = { '@_xmlns': XML_NS_URL };
      }

      if (!baseXmlObj[parentName][groupNode]) {
        baseXmlObj[parentName][groupNode] = [];
      }
      (baseXmlObj[parentName][groupNode] as JsonArray).push(childContents);
    }
    return baseXmlObj;
  }
}

/**
 * Creates write infos for any children that haven't been written yet. Children may
 * delay being written in order to find potential existing children to merge
 * with in the conversion pipeline.
 */
export class DecompositionFinalizer implements ConvertTransactionFinalizer {
  public async finalize(state: ConvertTransactionState): Promise<WriterFormat[]> {
    const writerData: WriterFormat[] = [];

    for (const toDecompose of Object.values(state.decompose)) {
      if (!toDecompose.foundMerge) {
        writerData.push({
          component: toDecompose.component.parent ?? toDecompose.component,
          writeInfos: [toDecompose.writeInfo],
        });
      }
    }

    return writerData;
  }

  private getOutputPathForEntry(child: MetadataComponent, parent: SourceComponent): string {
    const childName = child.fullName.split('.')[1];
    let output = `${childName}.${child.type.suffix}${META_XML_SUFFIX}`;

    if (parent.type.strategies.decomposition === DecompositionStrategy.FolderPerType) {
      output = join(child.type.directoryName, output);
    }

    return join(parent.getPackageRelativePath(parent.fullName, 'source'), output);
  }
}
