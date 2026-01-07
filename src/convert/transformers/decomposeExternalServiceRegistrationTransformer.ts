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
import * as path from 'node:path';
import { Readable } from 'node:stream';
import * as yaml from 'yaml';
import { XMLBuilder } from 'fast-xml-parser';
import type { ExternalServiceRegistration } from '@jsforce/jsforce-node/lib/api/metadata/schema';
import { WriteInfo } from '../types';
import { SourceComponent } from '../../resolve';
import { DEFAULT_PACKAGE_ROOT_SFDX, META_XML_SUFFIX, XML_DECL, XML_NS_KEY } from '../../common';
import { BaseMetadataTransformer } from './baseMetadataTransformer';

type SchemaType = 'json' | 'yaml';

type ESR = {
  ExternalServiceRegistration: ExternalServiceRegistration & { schemaUploadFileExtension: SchemaType };
};

const xmlDeclaration = '<?xml version="1.0" encoding="UTF-8"?>\n';

export class DecomposeExternalServiceRegistrationTransformer extends BaseMetadataTransformer {
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
    const schemaContent: string = xmlContent.schema ?? '';
    const schemaType = xmlContent.schemaUploadFileExtension ?? this.getSchemaType(schemaContent);
    const asYaml = schemaType === 'yaml' ? schemaContent : yaml.stringify(JSON.parse(schemaContent));
    const schemaFileName = `${component.fullName}.yaml`;
    const schemaFilePath = path.join(path.dirname(outputDir), schemaFileName);

    // make sure the schema type is set
    xmlContent.schemaUploadFileExtension = schemaType;

    // Write schema content to file
    writeInfos.push({
      source: Readable.from(asYaml),
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
      source: Readable.from(Buffer.from(xmlDeclaration + source)),
      output: esrFilePath,
    });

    return writeInfos;
  }

  public async toMetadataFormat(component: SourceComponent): Promise<WriteInfo[]> {
    // only need to do this once
    this.context.decomposedExternalServiceRegistration.externalServiceRegistration ??=
      this.registry.getTypeByName('ExternalServiceRegistration');
    const esrFilePath = component.xml;
    const esrContent = { ...(await component.parseXml<ESR>()).ExternalServiceRegistration };

    // Read schema content from file
    const schemaFileName = `${component.fullName}.yaml`; // or .json based on your logic
    const schemaFilePath = path.join(path.dirname(esrFilePath ?? ''), schemaFileName);
    // load the schema content from the file
    const schemaContent = (await component.tree.readFile(schemaFilePath)).toString();
    // Add schema content back to ESR content in its original format
    // if the original format was JSON, then convert the yaml to json otherwise leave as is
    esrContent.schema =
      esrContent.schemaUploadFileExtension === 'json'
        ? JSON.stringify(yaml.parse(schemaContent), undefined, 2)
        : schemaContent;

    // Write combined content back to md format
    this.context.decomposedExternalServiceRegistration.transactionState.esrRecords.set(component.fullName, {
      // @ts-expect-error Object literal may only specify known properties
      [XML_NS_KEY]: XML_DECL,
      ...esrContent,
    });

    return [];
  }

  // eslint-disable-next-line class-methods-use-this
  private getOutputFolder(format: string, component: SourceComponent, mergeWith?: SourceComponent): string {
    const base = format === 'source' ? DEFAULT_PACKAGE_ROOT_SFDX : '';
    const { type } = mergeWith ?? component;
    return path.join(base, type.directoryName);
  }

  // eslint-disable-next-line class-methods-use-this
  private getSchemaType(content: string): SchemaType {
    return content.trim().startsWith('{') ? 'json' : 'yaml';
  }
}
