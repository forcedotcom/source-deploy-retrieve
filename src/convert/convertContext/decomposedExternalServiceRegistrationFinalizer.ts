/*
 * Copyright 2026, Salesforce, Inc.
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
