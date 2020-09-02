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

const archiveTypes = new Map([
  ['application/zip', 'zip'],
  ['application/jar', 'jar'],
]);

export class StaticResourceMetadataTransformer extends BaseMetadataTransformer {
  public toMetadataFormat(): WriterFormat {
    let contentSource: Readable;
    const { content, type, xml } = this.component;
    const writerFormat: WriterFormat = {
      component: this.component,
      writeInfos: [],
    };

    if (this.componentIsExpandedArchive()) {
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

  public toSourceFormat(): WriterFormat {
    throw new Error('Method not implemented.');
  }

  private componentIsExpandedArchive(): boolean {
    const { content, tree } = this.component;
    if (tree.isDirectory(content)) {
      const contentType = (this.component.parseXml().StaticResource as JsonMap)
        .contentType as string;
      if (archiveTypes.has(contentType)) {
        return true;
      }
      throw new LibraryError('error_static_resource_expected_archive_type', [
        contentType,
        this.component.name,
      ]);
    }
    return false;
  }
}
