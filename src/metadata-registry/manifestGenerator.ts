/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { MetadataComponent } from './types';

export class ManifestGenerator {
  xmlDef = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  packageModuleStart =
    '<Package xmlns="http://soap.sforce.com/2006/04/metadata">';
  packageModuleEnd = '</Package>';
  public createManifest(
    components: MetadataComponent[],
    apiVersion = '48.0'
  ): string {
    let output = this.xmlDef.concat(this.packageModuleStart);
    for (const component of components) {
      const metadataType = component.type.name;
      output = output.concat(
        `<types><members>*</members><name>${metadataType}</name></types>`
      );
    }
    output = output.concat(
      `<version>${apiVersion}</version>`,
      this.packageModuleEnd
    );
    return output;
  }
}
