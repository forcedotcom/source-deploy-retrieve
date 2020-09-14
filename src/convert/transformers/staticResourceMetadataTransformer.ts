/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { BaseMetadataTransformer } from './baseMetadataTransformer';
import { WriterFormat, WriteInfo } from '..';
import { create as createArchive } from 'archiver';
import * as AdmZip from 'adm-zip';
import { getExtension } from 'mime';
import { basename, join } from 'path';
import { baseName } from '../../utils';
import { JsonMap } from '@salesforce/ts-types';
import { createReadStream } from 'fs';
import { Readable } from 'stream';
import { LibraryError } from '../../errors';
import { ARCHIVE_MIME_TYPES, FALLBACK_TYPE_MAP } from '../../utils/constants';
import { ArchiveReadable } from '../streams';

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
    const { xml, type, content } = this.component;
    const result: WriterFormat = { component: this.component, writeInfos: [] };

    if (content) {
      const contentType = this.getContentType();
      if (ARCHIVE_MIME_TYPES.has(contentType)) {
        const baseDir = join(type.directoryName, baseName(content));
        result.writeInfos.push(...this.createWriteInfosFromArchive(content, baseDir));
      } else {
        const extension = this.getExtensionFromType(contentType);
        result.writeInfos.push({
          source: createReadStream(content),
          relativeDestination: join(type.directoryName, `${baseName(content)}.${extension}`),
        });
      }

      result.writeInfos.push({
        source: createReadStream(xml),
        relativeDestination: join(type.directoryName, basename(xml)),
      });
    }
    return result;
  }

  private componentIsExpandedArchive(): boolean {
    const { content, tree } = this.component;
    if (tree.isDirectory(content)) {
      const contentType = this.getContentType();
      if (ARCHIVE_MIME_TYPES.has(contentType)) {
        return true;
      }
      throw new LibraryError('error_static_resource_expected_archive_type', [
        contentType,
        this.component.name,
      ]);
    }
    return false;
  }

  private getContentType(): string {
    return (this.component.parseXml().StaticResource as JsonMap).contentType as string;
  }

  private getExtensionFromType(contentType: string): string {
    let ext = getExtension(contentType);
    if (!ext && FALLBACK_TYPE_MAP.get(contentType)) {
      ext = FALLBACK_TYPE_MAP.get(contentType);
    }
    return ext || 'none';
  }

  private createWriteInfosFromArchive(zipPath: string, destDir: string): WriteInfo[] {
    const zip = new AdmZip(zipPath);
    const infos = zip
      .getEntries()
      .filter((e) => !e.isDirectory)
      .map((e) => {
        return {
          source: new ArchiveReadable(e),
          relativeDestination: join(destDir, e.entryName),
        };
      });
    return infos;
  }
}
