/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
// import * as fs from 'node:fs/promises';
// import * as path from 'node:path';
// import { Readable } from 'node:stream';
// import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import * as yaml from 'yaml';
import { JsonMap } from '@salesforce/ts-types';
import { WriteInfo } from '../types';
import { SourceComponent } from '../../resolve';
import { BaseMetadataTransformer } from './baseMetadataTransformer';

export type ESR = JsonMap & {
  ExternalServiceRegistration: {
    schema?: {
      _text: string;
    };
  };
};

export class DecomposeExternalServiceRegistrationTransformer extends BaseMetadataTransformer {
  // private xmlParser = new XMLParser({ ignoreAttributes: false });
  // private xmlBuilder = new XMLBuilder({ ignoreAttributes: false });

  // eslint-disable-next-line @typescript-eslint/require-await,class-methods-use-this,@typescript-eslint/no-unused-vars
  public async toSourceFormat(input: {
    component: SourceComponent;
    mergeWith?: SourceComponent | undefined;
  }): Promise<WriteInfo[]> {
    const writeInfos: WriteInfo[] = [];
    // const { component, mergeWith } = input;
    // const xmlContent = await component.parseXml<ESR>();
    // const esrContent = xmlContent.ExternalServiceRegistration;
    //
    // // Extract schema content
    // // eslint-disable-next-line no-underscore-dangle
    // const schemaContent = esrContent.schema?._text ?? '';
    // const schemaExtension = this.getSchemaExtension(schemaContent);
    // const schemaFileName = `${component.fullName}.schema.${schemaExtension}`;
    // const schemaFilePath = path.join(this.defaultDirectory ?? '', schemaFileName);
    //
    // // Write schema content to file
    // writeInfos.push({
    //   source: Readable.from(schemaContent),
    //   output: schemaFilePath
    // });
    //
    // // Remove schema content from ESR content
    // delete esrContent.schema;
    //
    // // Write remaining ESR content to file
    // const esrFileName = `${component.fullName}.externalServiceRegistration`;
    // const esrFilePath = path.join(this.defaultDirectory ?? '', esrFileName);
    // writeInfos.push({
    //   // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    //   source: this.xmlBuilder.build({ ExternalServiceRegistration: esrContent }),
    //   output: esrFilePath
    // });

    return writeInfos;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars,@typescript-eslint/require-await
  public async toMetadataFormat(component: SourceComponent): Promise<WriteInfo[]> {
    // only need to do this once
    this.context.decomposedExternalServiceRegistration.externalServiceRegistration ??=
      this.registry.getTypeByName('ExternalServiceRegistration');
    const writeInfos: WriteInfo[] = [];
    // const esrFilePath = this.getOutputFile(component);
    // const esrContent = await fs.readFile(esrFilePath, 'utf8');
    // // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    // const esrXml = this.xmlParser.parse(esrContent);
    //
    // // Read schema content from file
    // const schemaFileName = `${component.fullName}.schema.yaml`; // or .json based on your logic
    // const schemaFilePath = path.join(this.defaultDirectory ?? '', schemaFileName);
    // const schemaContent = await fs.readFile(schemaFilePath, 'utf8');
    //
    // // Add schema content back to ESR content
    // // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    // esrXml.ExternalServiceRegistration.schema = { _text: schemaContent };
    //
    // // Write combined content back to source format
    // writeInfos.push({
    //   // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    //   source: this.xmlBuilder.build(esrXml),
    //   output: esrFilePath
    // });

    return writeInfos;
  }

  // eslint-disable-next-line class-methods-use-this
  protected getOutputFile(component: SourceComponent, mergeWith?: SourceComponent): string {
    if (mergeWith?.xml) {
      return mergeWith.xml;
    }
    return component.xml ?? '';
  }

  // eslint-disable-next-line class-methods-use-this
  protected getSchemaExtension(content: string): string {
    try {
      yaml.parse(content);
      return 'yaml';
    } catch {
      return 'json';
    }
  }
}
