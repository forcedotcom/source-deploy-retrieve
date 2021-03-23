/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { JsonMap } from '@salesforce/ts-types';
import { SourceComponent } from '../metadata-registry/sourceComponent';
import { normalizeToArray } from './collections';

type CustomLabelsXml = {
  CustomLabels: {
    labels: CustomLabel | CustomLabel[];
  };
};

type CustomLabel = JsonMap & { fullName: string };

type Index = Map<string, string[]>;

export class LabelsIndex {
  private static instance: LabelsIndex;
  private components: Map<string, SourceComponent> = new Map();
  private index: Index = new Map();

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  public constructor() {}

  public static getInstance(): LabelsIndex {
    if (!LabelsIndex.instance) {
      LabelsIndex.instance = new LabelsIndex();
    }
    return LabelsIndex.instance;
  }

  public add(fsPath: string, component: SourceComponent): void {
    this.components.set(fsPath, component);
  }

  public async resolve(): Promise<Index> {
    for (const [fsPath, component] of [...this.components.entries()]) {
      const contents = await component.parseXml<CustomLabelsXml>();
      const labels = normalizeToArray(contents.CustomLabels.labels);
      for (const label of labels) {
        this.addLabelToIndex(fsPath, label);
      }
    }
    return this.index;
  }

  private addLabelToIndex(fsPath: string, label: CustomLabel): void {
    if (this.index.has(fsPath)) {
      const existing = this.index.get(fsPath);
      this.index.set(fsPath, [...existing, label.fullName]);
    } else {
      this.index.set(fsPath, [label.fullName]);
    }
  }
}
