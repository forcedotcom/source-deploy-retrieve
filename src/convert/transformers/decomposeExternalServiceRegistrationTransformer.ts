/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { Readable } from 'node:stream';
import * as yaml from 'yaml';
import { XMLBuilder } from 'fast-xml-parser';
import type { ExternalServiceRegistration } from '@jsforce/jsforce-node/lib/api/metadata/schema';
import { JsonMap } from '@salesforce/ts-types';
import { WriteInfo } from '../types';
import { SourceComponent } from '../../resolve';
import { DEFAULT_PACKAGE_ROOT_SFDX, META_XML_SUFFIX } from '../../common';
import { BaseMetadataTransformer } from './baseMetadataTransformer';

type ESR = JsonMap & {
  ExternalServiceRegistration: ExternalServiceRegistration;
};

const xmlDeclaration = '<?xml version="1.0" encoding="UTF-8"?>\n';

export class DecomposeExternalServiceRegistrationTransformer extends BaseMetadataTransformer {
  // eslint-disable-next-line @typescript-eslint/require-await,class-methods-use-this,@typescript-eslint/no-unused-vars
  public async toSourceFormat(input: {
    component: SourceComponent;
    mergeWith?: SourceComponent | undefined;
  }): Promise<WriteInfo[]> {
    this.context.decomposedExternalServiceRegistration.externalServiceRegistration ??=
      this.registry.getTypeByName('ExternalServiceRegistration');
    const writeInfos: WriteInfo[] = [];
    const { component } = input;
    const outputDir = path.join(
      this.getOutputFolder('source', component),
      this.context.decomposedExternalServiceRegistration.externalServiceRegistration.directoryName
    );
    const xmlContent = { ...(await component.parseXml<ESR>()).ExternalServiceRegistration };

    // Extract schema content
    // eslint-disable-next-line no-underscore-dangle
    const schemaContent: string = xmlContent.schema ?? '';
    const schemaExtension = this.getSchemaExtension(schemaContent);
    const schemaFileName = `${component.fullName}.${schemaExtension}`;
    const schemaFilePath = path.join(path.dirname(outputDir), schemaFileName);

    // Write schema content to file
    writeInfos.push({
      source: Readable.from(schemaContent),
      output: schemaFilePath,
    });

    // Remove schema content from ESR content
    delete xmlContent.schema;

    // Write remaining ESR content to file
    const esrFileName = `${component.fullName}.externalServiceRegistration`;
    const esrFilePath = path.join(path.dirname(outputDir), `${esrFileName}${META_XML_SUFFIX}`);
    const xmlBuilder = new XMLBuilder({
      format: true,
      ignoreAttributes: false,
      suppressUnpairedNode: true,
      processEntities: true,
      indentBy: '    ',
    });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const source = xmlBuilder.build({ ExternalServiceRegistration: xmlContent });
    writeInfos.push({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      source: Readable.from(Buffer.from(xmlDeclaration + source)),
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
    const esrFilePath = component.xml;
    const esrContent = { ...(await component.parseXml<ESR>()).ExternalServiceRegistration };

    // Read schema content from file
    const schemaFileName = `${component.fullName}.yaml`; // or .json based on your logic
    const schemaFilePath = path.join(path.dirname(esrFilePath ?? ''), schemaFileName);
    // Add schema content back to ESR content
    esrContent.schema = await fs.readFile(schemaFilePath, 'utf8');
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
    const source = xmlBuilder.build({ ExternalServiceRegistration: esrContent });
    // Write combined content back to md format
    writeInfos.push({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument,@typescript-eslint/no-unsafe-assignment
      source: Readable.from(Buffer.from(xmlDeclaration + source)),
      output: path.resolve(esrMdApiFilePath),
    });
    this.context.decomposedExternalServiceRegistration.transactionState.esrRecords.push({ component, writeInfos });

    return [];
  }

  // eslint-disable-next-line class-methods-use-this,@typescript-eslint/no-unused-vars
  private getOutputFolder(format: string, component: SourceComponent, mergeWith?: SourceComponent): string {
    const base = format === 'source' ? DEFAULT_PACKAGE_ROOT_SFDX : '';
    const { type } = mergeWith ?? component;
    return path.join(base, type.directoryName);
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
