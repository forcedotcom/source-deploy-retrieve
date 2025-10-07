/*
 * Copyright 2025, Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { MetadataComponent } from '../../resolve/types';
import { WriteInfo, WriterFormat } from '../types';
import { ConvertTransactionFinalizer } from './transactionFinalizer';

export type DecompositionStateValue = {
  /** mark it true if the merge has been found.  Absence of a value means "it wasn't found yet'" */
  foundMerge?: true;
  writeInfo?: WriteInfo;
  origin?: MetadataComponent;
};
export type DecompositionState = Map<string, DecompositionStateValue>;

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
    return (
      Array.from(this.transactionState.entries())
        .filter(hasFullDecompositionInfo)
        // return `false` and the undefined
        .filter(([, value]) => !value.foundMerge)
        .map(([, value]) => ({ component: value.origin?.parent ?? value.origin, writeInfos: [value.writeInfo] }))
    );
  }
}
