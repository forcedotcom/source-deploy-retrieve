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
