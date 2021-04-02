/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { XML_DECL } from '../common';
import { MetadataResolver } from './metadataResolver';
import { RegistryError } from '../errors';
import { SourceComponent } from './sourceComponent';
import { writeFileSync } from 'fs';
import { RegistryAccess } from '../registry/registryAccess';
import { MetadataComponent } from './types';

export class ManifestGenerator {
  private packageModuleStart = '<Package xmlns="http://soap.sforce.com/2006/04/metadata">\n';
  private packageModuleEnd = '</Package>\n';
  private resolver: MetadataResolver;
  private registry: RegistryAccess;

  constructor(resolver = new MetadataResolver(), registry = new RegistryAccess()) {
    this.resolver = resolver;
    this.registry = registry;
  }

  public createManifestFromPath(sourcePath: string, outputPath: string): void {
    try {
      const mdComponents: SourceComponent[] = this.resolver.getComponentsFromPath(sourcePath);
      writeFileSync(outputPath, this.createManifest(mdComponents));
    } catch (err) {
      throw new RegistryError('error_on_manifest_creation', [sourcePath, err]);
    }
  }

  public createManifest(
    components: MetadataComponent[],
    apiVersion = this.registry.apiVersion,
    indent = '  '
  ): string {
    let output = XML_DECL.concat(this.packageModuleStart);
    const metadataMap = this.createMetadataMap(components);
    for (const metadataType of metadataMap.keys()) {
      output = output.concat(`${indent}<types>\n`);
      for (const metadataName of metadataMap.get(metadataType)) {
        output = output.concat(`${indent}${indent}<members>${metadataName}</members>\n`);
      }
      output = output.concat(`${indent}${indent}<name>${metadataType}</name>\n`);
      output = output.concat(`${indent}</types>\n`);
    }
    output = output.concat(`${indent}<version>${apiVersion}</version>\n`, this.packageModuleEnd);
    return output;
  }

  private createMetadataMap(components: MetadataComponent[]): Map<string, Set<string>> {
    const metadataMap: Map<string, Set<string>> = new Map<string, Set<string>>();
    for (const component of components) {
      const {
        fullName,
        type: { name: typeName },
      } = component;
      if (metadataMap.has(typeName)) {
        const metadataNames = metadataMap.get(typeName);
        metadataNames.add(fullName);
        metadataMap.set(typeName, metadataNames);
      } else {
        const metadataNames: Set<string> = new Set<string>();
        metadataNames.add(fullName);
        metadataMap.set(typeName, metadataNames);
      }
    }
    return metadataMap;
  }
}
