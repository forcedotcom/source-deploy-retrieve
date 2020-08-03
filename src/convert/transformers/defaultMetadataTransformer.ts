/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { META_XML_SUFFIX } from '../../utils';
import { createReadStream } from 'fs';
import { LibraryError } from '../../errors';
import { BaseMetadataTransformer } from './baseMetadataTransformer';
import { WriterFormat } from '../../types';

/**
 * The default metadata transformer.
 *
 * If a metadata type doesn't have a transformer assigned to it, this one is used
 * during the conversion process. It leaves the component's metadata xml and source
 * files as-is.
 */
export class DefaultMetadataTransformer extends BaseMetadataTransformer {
  public toMetadataFormat(): WriterFormat {
    const result: WriterFormat = { component: this.component, writeInfos: [] };
    let xmlDest = this.component.getPackageRelativePath(this.component.xml);
    if (this.component.content) {
      for (const source of this.component.walkContent()) {
        result.writeInfos.push({
          source: createReadStream(source),
          relativeDestination: this.component.getPackageRelativePath(source),
        });
      }
    } else {
      xmlDest = xmlDest.slice(0, xmlDest.lastIndexOf(META_XML_SUFFIX));
    }
    result.writeInfos.push({
      source: createReadStream(this.component.xml),
      relativeDestination: xmlDest,
    });
    return result;
  }

  public toSourceFormat(): WriterFormat {
    throw new LibraryError('error_convert_not_implemented', ['source', this.component.type.name]);
  }
}
