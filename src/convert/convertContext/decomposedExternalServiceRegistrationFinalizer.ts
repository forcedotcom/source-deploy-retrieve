/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { WriterFormat } from '../types';
import { MetadataType } from '../../registry';
import { WriteInfo } from '../types';
import { SourceComponent } from '../../resolve';
import { ConvertTransactionFinalizer } from './transactionFinalizer';

type ExternalServiceRegistrationState = {
  esrRecords: Array<{ component: SourceComponent; writeInfos: WriteInfo[] }>;
};

export class DecomposedExternalServiceRegistrationFinalizer extends ConvertTransactionFinalizer<ExternalServiceRegistrationState> {
  /** to support custom presets (the only way this code should get hit at all pass in the type from a transformer that has registry access */
  public externalServiceRegistration?: MetadataType;
  public transactionState: ExternalServiceRegistrationState = {
    esrRecords: [],
  };
  // eslint-disable-next-line class-methods-use-this
  public defaultDir: string | undefined;

  public finalize(defaultDirectory: string | undefined): Promise<WriterFormat[]> {
    this.defaultDir = defaultDirectory;
    const writerFormats: WriterFormat[] = this.transactionState.esrRecords.map((esrRecord) => {
      const { component, writeInfos } = esrRecord;
      const fullName = component.fullName ?? '';
      const outputDir = this.defaultDir ? this.defaultDir : '';
      const esrFileName = `${fullName}.externalServiceRegistration`;
      const esrFilePath = `${outputDir}/${esrFileName}`;
      return { component, writeInfos, output: esrFilePath };
    });
    return Promise.resolve(writerFormats);
  }
}
