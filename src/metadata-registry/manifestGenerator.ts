/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { MetadataComponent } from '../common';
import { RegistryAccess } from './registryAccess';
import { RegistryError } from '../errors';
import { SourceComponent } from './sourceComponent';
import { writeFileSync } from 'fs';
import { XML_DECL } from '../utils/constants';

export class ManifestGenerator {
  private packageModuleStart = '<Package xmlns="http://soap.sforce.com/2006/04/metadata">\n';
  private packageModuleEnd = '</Package>';
  private registryAccess: RegistryAccess;

  constructor(registryAccess = new RegistryAccess()) {
    this.registryAccess = registryAccess;
  }

  public createManifestFromPath(sourcePath: string, outputPath: string): void {
    try {
      const mdComponents: SourceComponent[] = this.registryAccess.getComponentsFromPath(sourcePath);
      writeFileSync(outputPath, this.createManifest(mdComponents));
    } catch (err) {
      throw new RegistryError('error_on_manifest_creation', [sourcePath, err]);
    }
  }

  public createManifest(
    components: MetadataComponent[],
    apiVersion = this.registryAccess.getApiVersion()
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
      const metadataType = this.registryAccess.getTypeFromName(component.type.name).name;
      const metadataName = component.fullName;
      if (metadataMap.has(metadataType)) {
        const metadataNames = metadataMap.get(metadataType);
        metadataNames.add(metadataName);
        metadataMap.set(metadataType, metadataNames);
      } else {
        const metadataNames: Set<string> = new Set<string>();
        metadataNames.add(metadataName);
        metadataMap.set(metadataType, metadataNames);
      }
    }
    return metadataMap;
  }
}
