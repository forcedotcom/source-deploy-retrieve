/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { MetadataComponent, XML_DECL } from '../common';
import { MetadataResolver } from './metadataResolver';
import { RegistryError } from '../errors';
import { SourceComponent } from './sourceComponent';
import { writeFileSync } from 'fs';

export class ManifestGenerator {
  private packageModuleStart = '<Package xmlns="http://soap.sforce.com/2006/04/metadata">\n';
  private packageModuleEnd = '</Package>';
  private resolver: MetadataResolver;

  constructor(resolver = new MetadataResolver()) {
    this.resolver = resolver;
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
    apiVersion = this.resolver.getApiVersion()
  ): string {
    let output = XML_DECL.concat(this.packageModuleStart);
    const metadataMap = this.createMetadataMap(components);
    for (const metadataType of metadataMap.keys()) {
      output = output.concat('  <types>\n');
      for (const metadataName of metadataMap.get(metadataType)) {
        output = output.concat(`    <members>${metadataName}</members>\n`);
      }
      output = output.concat(`    <name>${metadataType}</name>\n`);
      output = output.concat('  </types>\n');
    }
    output = output.concat(`  <version>${apiVersion}</version>\n`, this.packageModuleEnd);
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
