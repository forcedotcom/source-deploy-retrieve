/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ComponentSet } from '../../collections/componentSet';
import { SourceComponent } from '../../resolve/sourceComponent';
import { MetadataComponent } from '../../resolve/types';
import { WriteInfo, WriterFormat } from '../types';
import { ConvertTransactionFinalizer } from './transactionFinalizer';

export type DecompositionStateValue = {
  foundMerge?: boolean;
  writeInfo?: WriteInfo;
  origin?: MetadataComponent;
  component?: SourceComponent;
  children?: ComponentSet;
};
type DecompositionState = Map<string, DecompositionStateValue>;

/** DecompositionStateValue has all props as optional.  The makes writeInfo and origin required  */
const hasFullDecompositionInfo = (
  value: [string, DecompositionStateValue]
): value is [string, DecompositionStateValue & { writeInfo: WriteInfo; origin: MetadataComponent }] =>
  Boolean(value[1].writeInfo) && Boolean(value[1].origin);

/**
 * Creates write infos for any children that haven't been written yet. Children may
 * delay being written in order to find potential existing children to merge
 * with in the conversion pipeline.
 */
export class DecompositionFinalizer extends ConvertTransactionFinalizer<DecompositionState> {
  public transactionState: DecompositionState = new Map<string, DecompositionStateValue>();

  // eslint-disable-next-line @typescript-eslint/require-await
  public async finalize(): Promise<WriterFormat[]> {
    return Array.from(this.transactionState.entries())
      .filter(hasFullDecompositionInfo)
      .filter(([, value]) => !value.foundMerge)
      .map(([, value]) => ({ component: value.origin?.parent ?? value.origin, writeInfos: [value.writeInfo] }));
  }
}
