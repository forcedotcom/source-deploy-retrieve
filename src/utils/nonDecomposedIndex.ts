/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { get, JsonMap } from '@salesforce/ts-types';
import { SourceComponent } from '../metadata-registry/sourceComponent';
import { normalizeToArray } from './collections';

export type CustomLabelsObj = {
  CustomLabels: {
    labels: CustomLabel | CustomLabel[];
  };
};

export type CustomLabel = JsonMap & { fullName: string };

type Index = Map<string, string[]>;

export class NonDecomposedIndex {
  private static instance: NonDecomposedIndex;
  private components: Map<string, SourceComponent> = new Map();
  private index: Index = new Map();

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  public constructor() {}

  public static getInstance(): NonDecomposedIndex {
    if (!NonDecomposedIndex.instance) {
      NonDecomposedIndex.instance = new NonDecomposedIndex();
    }
    return NonDecomposedIndex.instance;
  }

  /**
   * Register a SourceComponent to be resolved later.
   */
  public register(fsPath: string, component: SourceComponent): void {
    this.components.set(fsPath, component);
  }

  /**
   * Read and parse the xml either:
   * - for all registered SourceComponents
   * - or, the provided SourceComponents
   */
  public async resolve(...components: SourceComponent[]): Promise<Index> {
    const filtered = components.filter((c) => !!c);
    const componentsToResolve = filtered.length
      ? (filtered.map((c) => [c.xml, c]) as [string, SourceComponent][])
      : [...this.components.entries()];

    for (const [fsPath, component] of componentsToResolve) {
      const contents = await component.parseXml();
      const { xmlPath, nameAttr } = component.type.strategies.elementParser;
      const elements = normalizeToArray(get(contents, xmlPath, []) as JsonMap[]);
      const elementNames = elements.map((e) => e[nameAttr]) as string[];
      this.addToIndex(fsPath, elementNames);
    }
    return this.index;
  }

  private addToIndex(fsPath: string, elements: string[]): void {
    if (this.index.has(fsPath)) {
      const existing = this.index.get(fsPath);
      this.index.set(fsPath, [...existing, ...elements]);
    } else {
      this.index.set(fsPath, elements);
    }
  }
}
