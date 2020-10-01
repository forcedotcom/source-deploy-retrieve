/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { META_XML_SUFFIX } from '../../utils';
import { createReadStream } from 'fs';
import { BaseMetadataTransformer } from './baseMetadataTransformer';
import { SfdxFileFormat, WriterFormat } from '../types';
import { SourceComponent } from '../../metadata-registry';

/**
 * The default metadata transformer.
 *
 * If a metadata type doesn't have a transformer assigned to it, this one is used
 * during the conversion process. It leaves the component's metadata xml and source
 * files as-is.
 */
export class DefaultMetadataTransformer extends BaseMetadataTransformer {
  public async toMetadataFormat(component: SourceComponent): Promise<WriterFormat> {
    return this.getWriterFormat(component, 'metadata');
  }

  public async toSourceFormat(component: SourceComponent): Promise<WriterFormat> {
    return this.getWriterFormat(component, 'source');
  }

  private getWriterFormat(component: SourceComponent, toFormat: SfdxFileFormat): WriterFormat {
    const result: WriterFormat = { component: component, writeInfos: [] };
    if (component.content) {
      for (const source of component.walkContent()) {
        result.writeInfos.push({
          source: createReadStream(source),
          relativeDestination: component.getPackageRelativePath(source, toFormat),
        });
      }
    }

    if (component.xml) {
      let xmlDest = component.getPackageRelativePath(component.xml, toFormat);
      if (!component.content) {
        xmlDest =
          toFormat === 'metadata'
            ? xmlDest.slice(0, xmlDest.lastIndexOf(META_XML_SUFFIX))
            : `${xmlDest}${META_XML_SUFFIX}`;
      }
      result.writeInfos.push({
        source: createReadStream(component.xml),
        relativeDestination: xmlDest,
      });
    }
    return result;
  }
}
