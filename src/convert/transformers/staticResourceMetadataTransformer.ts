/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { BaseMetadataTransformer } from './baseMetadataTransformer';
import { WriterFormat } from '..';
import { create as createArchive } from 'archiver';
import { basename, join } from 'path';
import { baseName } from '../../utils';
import { JsonMap } from '@salesforce/ts-types';
import { createReadStream } from 'fs';
import { Readable } from 'stream';
import { LibraryError } from '../../errors';
import { ARCHIVE_MIME_TYPES } from '../../utils/constants';
import { SourceComponent } from '../../metadata-registry';

export class StaticResourceMetadataTransformer extends BaseMetadataTransformer {
  public toMetadataFormat(component: SourceComponent): WriterFormat {
    let contentSource: Readable;
    const { content, type, xml } = component;
    const writerFormat: WriterFormat = {
      component,
      writeInfos: [],
    };

    if (this.componentIsExpandedArchive(component)) {
      const zip = createArchive('zip', { zlib: { level: 3 } });
      zip.directory(content, false);
      zip.finalize();
      contentSource = zip;
    } else {
      contentSource = createReadStream(content);
    }

    writerFormat.writeInfos.push(
      {
        source: contentSource,
        relativeDestination: join(type.directoryName, `${baseName(content)}.${type.suffix}`),
      },
      {
        source: createReadStream(xml),
        relativeDestination: join(type.directoryName, basename(xml)),
      }
    );

    return writerFormat;
  }

  public toSourceFormat(component: SourceComponent): WriterFormat {
    throw new LibraryError('error_convert_not_implemented', ['source', component.type.name]);
  }

  private componentIsExpandedArchive(component: SourceComponent): boolean {
    const { content, tree } = component;
    if (tree.isDirectory(content)) {
      const contentType = (component.parseXml().StaticResource as JsonMap).contentType as string;
      if (ARCHIVE_MIME_TYPES.has(contentType)) {
        return true;
      }
      throw new LibraryError('error_static_resource_expected_archive_type', [
        contentType,
        component.name,
      ]);
    }
    return false;
  }
}
