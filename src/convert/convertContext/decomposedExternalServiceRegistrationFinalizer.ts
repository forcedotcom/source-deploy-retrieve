/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { WriterFormat } from '../types';
import { MetadataType } from '../../registry';
import { ConvertTransactionFinalizer } from './transactionFinalizer';

type ExternalServiceRegistration = unknown;

export class DecomposedExternalServiceRegistrationFinalizer extends ConvertTransactionFinalizer<ExternalServiceRegistration> {
  /** to support custom presets (the only way this code should get hit at all pass in the type from a transformer that has registry access */
  public externalServiceRegistration?: MetadataType;
  protected transactionState: ExternalServiceRegistration;
  // eslint-disable-next-line class-methods-use-this
  protected defaultDir: string | undefined;

  public finalize(defaultDirectory: string | undefined): Promise<WriterFormat[]> {
    this.defaultDir = defaultDirectory;
    return Promise.resolve([]);
  }
}
