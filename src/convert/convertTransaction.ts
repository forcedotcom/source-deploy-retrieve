/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { WriterFormat } from './types';
import { DecomposedMetadataTransformer } from './transformers/decomposedMetadataTransformer';
import { SourceComponent } from '../metadata-registry';

export type ConvertTransactionState = {
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
};

/**
 * Manages a "global" state over the course of a single metadata conversion call.
 */
export class ConvertTransaction {
  public readonly state: ConvertTransactionState = { recompose: {} };
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
  public *executeFinalizers(): IterableIterator<WriterFormat | WriterFormat[]> {
    for (const finalizer of this.finalizers.values()) {
      yield finalizer.finalize(this.state);
    }
  }
}

/**
 * Logic to execute at the end of a convert transaction
 */
export interface ConvertTransactionFinalizer {
  finalize(state: ConvertTransactionState): WriterFormat | WriterFormat[];
}

export interface FinalizerConstructor {
  new (): ConvertTransactionFinalizer;
}

export class RecompositionFinalizer implements ConvertTransactionFinalizer {
  public finalize(state: ConvertTransactionState): WriterFormat[] {
    const writerData: WriterFormat[] = [];

    for (const parentName of Object.keys(state.recompose)) {
      const parentComponent = state.recompose[parentName].component;
      // only recompose children stored in transaction state
      const children = state.recompose[parentName].children;
      const recomposedXmlObj = DecomposedMetadataTransformer.recompose(children);
      const writerFormat = DecomposedMetadataTransformer.createWriterFormat(
        parentComponent,
        recomposedXmlObj
      );
      writerData.push(writerFormat);
    }

    return writerData;
  }
}
