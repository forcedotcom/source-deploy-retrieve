/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { WriteInfo } from '../types';
import { BaseMetadataTransformer } from './baseMetadataTransformer';
import { SourceComponent } from '../../metadata-registry';
import { SourcePath, MetadataComponent } from '../../common';
import { DecompositionState } from '../convertContext';

export class CustomLabelsMetadataTransformer extends BaseMetadataTransformer {
  public async toMetadataFormat(component: SourceComponent): Promise<WriteInfo[]> {
    console.log(component);
    throw new Error('implement me');
  }

  public async toSourceFormat(
    component: SourceComponent,
    mergeWith?: SourceComponent
  ): Promise<WriteInfo[]> {
    console.log(component);
    console.log(mergeWith);
    throw new Error('implement me');
  }

  private async getComposedMetadataEntries(
    component: SourceComponent
  ): Promise<[string, unknown][]> {
    console.log(component);
    throw new Error('implement me');
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
    console.log(forComponent);
    console.log(props);
    throw new Error('implement me');
  }

  private getDecomposedState<T extends string>(
    forComponent: MetadataComponent
  ): DecompositionState[T] {
    console.log(forComponent);
    throw new Error('implement me');
  }

  private getDefaultOutput(component: MetadataComponent): SourcePath {
    console.log(component);
    throw new Error('implement me');
  }
}
