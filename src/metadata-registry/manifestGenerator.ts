/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { MetadataComponent } from '../types';
import { RegistryAccess } from '../metadata-registry/index';
import { createFiles } from '../utils';
import { RegistryError } from '../errors';

export class ManifestGenerator {
  xmlDef = '<?xml version="1.0" encoding="UTF-8"?>\n';
  packageModuleStart =
    '<Package xmlns="http://soap.sforce.com/2006/04/metadata">\n';
  packageModuleEnd = '</Package>';
  registryAccess = new RegistryAccess();

  public createManifestFromPath(sourcePath: string, outputPath: string): void {
    try {
      const mdComponents: MetadataComponent[] = this.registryAccess.getComponentsFromPath(
        sourcePath
      );
      const manifestMap = new Map().set(
        outputPath,
        this.createManifest(mdComponents)
      );
      createFiles(manifestMap);
    } catch (err) {
      throw new RegistryError('error_on_manifest_creation', [sourcePath, err]);
    }
  }

  public createManifest(
    components: MetadataComponent[],
    apiVersion = this.registryAccess.getApiVersion()
  ): string {
    let output = this.xmlDef.concat(this.packageModuleStart);
    const metadataMap = this.createMetadataMap(components);
    for (const metadataType of metadataMap.keys()) {
      output = output.concat('  <types>\n');
      output = output.concat(`    <name>${metadataType}</name>\n`);
      for (const metadataName of metadataMap.get(metadataType)) {
        output = output.concat(`    <members>${metadataName}</members>\n`);
      }
      output = output.concat('  </types>\n');
    }
    output = output.concat(
      `  <version>${apiVersion}</version>\n`,
      this.packageModuleEnd
    );
    return output;
  }

  private createMetadataMap(
    components: MetadataComponent[]
  ): Map<string, Set<string>> {
    const metadataMap: Map<string, Set<string>> = new Map<
      string,
      Set<string>
    >();
    for (const component of components) {
      const metadataType = this.registryAccess.getTypeFromName(
        component.type.name
      ).name;
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
