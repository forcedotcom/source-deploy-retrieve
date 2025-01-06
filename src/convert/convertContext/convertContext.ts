/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { WriterFormat } from '../types';
import { RecompositionFinalizer } from './recompositionFinalizer';
import { NonDecompositionFinalizer } from './nonDecompositionFinalizer';
import { DecompositionFinalizer } from './decompositionFinalizer';
import { ConvertTransactionFinalizer } from './transactionFinalizer';
import { DecomposedLabelsFinalizer } from './decomposedLabelsFinalizer';
import { DecomposedPermissionSetFinalizer } from './decomposedPermissionSetFinalizer';
import { DecomposedExternalServiceRegistrationFinalizer } from './decomposedExternalServiceRegistrationFinalizer';
/**
 * A state manager over the course of a single metadata conversion call.
 */
export class ConvertContext {
  public readonly decomposition = new DecompositionFinalizer();
  public readonly recomposition = new RecompositionFinalizer();
  public readonly nonDecomposition = new NonDecompositionFinalizer();
  public readonly decomposedLabels = new DecomposedLabelsFinalizer();
  public readonly decomposedPermissionSet = new DecomposedPermissionSetFinalizer();
  public readonly decomposedExternalServiceRegistration = new DecomposedExternalServiceRegistrationFinalizer();

  // eslint-disable-next-line @typescript-eslint/require-await
  public async *executeFinalizers(defaultDirectory?: string): AsyncIterable<WriterFormat[]> {
    for (const member of Object.values(this)) {
      if (member instanceof ConvertTransactionFinalizer) {
        yield member.finalize(defaultDirectory);
      }
    }
  }
}
