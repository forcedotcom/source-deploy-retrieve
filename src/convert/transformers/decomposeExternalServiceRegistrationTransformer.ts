/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { Readable } from 'node:stream';
import * as yaml from 'yaml';
import { JsonMap } from '@salesforce/ts-types';
import { XMLBuilder, XMLParser } from 'fast-xml-parser';
import { WriteInfo } from '../types';
import { SourceComponent } from '../../resolve';
import { BaseMetadataTransformer } from './baseMetadataTransformer';

export type ESR = JsonMap & {
  ExternalServiceRegistration: {
    schema?: string;
  };
};

export class DecomposeExternalServiceRegistrationTransformer extends BaseMetadataTransformer {
  // eslint-disable-next-line @typescript-eslint/require-await,class-methods-use-this,@typescript-eslint/no-unused-vars
  public async toSourceFormat(input: {
    component: SourceComponent;
    mergeWith?: SourceComponent | undefined;
  }): Promise<WriteInfo[]> {
    const writeInfos: WriteInfo[] = [];
    const { component } = input;
    const xmlContent = await component.parseXml<ESR>();
    const esrContent = xmlContent.ExternalServiceRegistration;

    // Extract schema content
    // eslint-disable-next-line no-underscore-dangle
    const schemaContent: string = esrContent.schema ?? '';
    const schemaExtension = this.getSchemaExtension(schemaContent);
    const schemaFileName = `${component.fullName}.${schemaExtension}`;
    const schemaFilePath = path.join(this.defaultDirectory ?? '', component.type.directoryName, schemaFileName);

    // Write schema content to file
    writeInfos.push({
      source: Readable.from(schemaContent),
      output: schemaFilePath,
    });

    // Remove schema content from ESR content
    delete esrContent.schema;

    // Write remaining ESR content to file
    const esrFileName = `${component.fullName}.externalServiceRegistration`;
    const esrFilePath = path.join(this.defaultDirectory ?? '', component.type.directoryName, `${esrFileName}-meta.xml`);
    const xmlBuilder = new XMLBuilder({
      format: true,
      ignoreAttributes: false,
      suppressUnpairedNode: true,
      processEntities: false,
      indentBy: '    ',
    });
    writeInfos.push({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      source: xmlBuilder.build({ ExternalServiceRegistration: esrContent }),
      output: esrFilePath,
    });

    return writeInfos;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars,@typescript-eslint/require-await
  public async toMetadataFormat(component: SourceComponent): Promise<WriteInfo[]> {
    // only need to do this once
    this.context.decomposedExternalServiceRegistration.externalServiceRegistration ??=
      this.registry.getTypeByName('ExternalServiceRegistration');
    const writeInfos: WriteInfo[] = [];
    const esrFilePath = this.getOutputFile(component);
    const esrContent = await fs.readFile(esrFilePath, 'utf8');
    const xmlParser = new XMLParser({
      ignoreAttributes: false,
    });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const esrXml = xmlParser.parse(esrContent);

    // Read schema content from file
    const schemaFileName = `${component.fullName}.yaml`; // or .json based on your logic
    const schemaFilePath = path.join(path.dirname(esrFilePath) ?? '', schemaFileName);
    // Add schema content back to ESR content
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    esrXml.ExternalServiceRegistration['schema'] = await fs.readFile(schemaFilePath, 'utf8');
    const esrMdApiFilePath = `${path.join(
      this.defaultDirectory ?? '',
      component.type.directoryName,
      component.fullName
    )}.externalServiceRegistration`;

    const xmlBuilder = new XMLBuilder({
      format: true,
      ignoreAttributes: false,
      suppressUnpairedNode: true,
      processEntities: true,
      indentBy: '    ',
    });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const source = xmlBuilder.build(esrXml);

    // Write combined content back to source format
    writeInfos.push({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      source,
      output: path.resolve(esrMdApiFilePath),
    });

    return writeInfos;
  }

  // eslint-disable-next-line class-methods-use-this
  private getOutputFile(component: SourceComponent, mergeWith?: SourceComponent): string {
    if (mergeWith?.xml) {
      return mergeWith.xml;
    }
    return component.xml ?? '';
  }

  // eslint-disable-next-line class-methods-use-this
  private getSchemaExtension(content: string): string {
    try {
      yaml.parse(content);
      return 'yaml';
    } catch {
      return 'json';
    }
  }
}
