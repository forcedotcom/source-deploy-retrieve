/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { join } from 'node:path';
import type { ExternalServiceRegistration } from '@jsforce/jsforce-node/lib/api/metadata/schema';
import { ensure, ensureString } from '@salesforce/ts-types';
import { WriterFormat } from '../types';
import { MetadataType } from '../../registry';
import { JsToXml } from '../streams';
import { ConvertTransactionFinalizer } from './transactionFinalizer';

type ExternalServiceRegistrationState = {
  esrRecords: Map<string, ExternalServiceRegistration>;
};

export class DecomposedExternalServiceRegistrationFinalizer extends ConvertTransactionFinalizer<ExternalServiceRegistrationState> {
  /** to support custom presets (the only way this code should get hit at all pass in the type from a transformer that has registry access */
  public externalServiceRegistration?: MetadataType;
  public transactionState: ExternalServiceRegistrationState = {
    esrRecords: new Map<string, ExternalServiceRegistration>(),
  };
  // eslint-disable-next-line class-methods-use-this
  public defaultDir: string | undefined;

  public finalize(defaultDirectory: string | undefined): Promise<WriterFormat[]> {
    this.defaultDir = defaultDirectory;
    const writerFormats: WriterFormat[] = [];
    this.transactionState.esrRecords.forEach((esrRecord, parent) =>
      writerFormats.push({
        component: {
          type: ensure(this.externalServiceRegistration, 'DecomposedESRFinalizer should have set .ESR'),
          fullName: ensureString(parent),
        },
        writeInfos: [
          {
            output: join(
              ensure(this.externalServiceRegistration?.directoryName, 'directory name missing'),
              `${parent}.externalServiceRegistration`
            ),
            source: new JsToXml({ ExternalServiceRegistration: { ...esrRecord } }),
          },
        ],
      })
    );
    return Promise.resolve(writerFormats);
  }
}
