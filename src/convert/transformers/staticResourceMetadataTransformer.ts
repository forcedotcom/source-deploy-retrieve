/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { BaseMetadataTransformer } from './baseMetadataTransformer';
import { WriterFormat, WriteInfo } from '..';
import { create as createArchive } from 'archiver';
import { getExtension } from 'mime';
import { Open } from 'unzipper';
import { basename, join } from 'path';
import { baseName } from '../../utils';
import { JsonMap } from '@salesforce/ts-types';
import { Readable } from 'stream';
import { LibraryError } from '../../errors';
import { ARCHIVE_MIME_TYPES, DEFAULT_CONTENT_TYPE, FALLBACK_TYPE_MAP } from '../../utils/constants';
import { SourceComponent } from '../../metadata-registry';

export class StaticResourceMetadataTransformer extends BaseMetadataTransformer {
  public async toMetadataFormat(component: SourceComponent): Promise<WriterFormat> {
    let contentSource: Readable;
    const { content, type, xml } = component;
    const writerFormat: WriterFormat = {
      component,
      writeInfos: [],
    };

    if (await this.componentIsExpandedArchive(component)) {
      const zip = createArchive('zip', { zlib: { level: 3 } });
      zip.directory(content, false);
      zip.finalize();
      contentSource = zip;
    } else {
      contentSource = component.tree.stream(content);
    }

    writerFormat.writeInfos.push(
      {
        source: contentSource,
        relativeDestination: join(type.directoryName, `${baseName(content)}.${type.suffix}`),
      },
      {
        source: component.tree.stream(xml),
        relativeDestination: join(type.directoryName, basename(xml)),
      }
    );

    return writerFormat;
  }

  public async toSourceFormat(component: SourceComponent): Promise<WriterFormat> {
    const { xml, content } = component;
    const result: WriterFormat = { component, writeInfos: [] };

    if (content) {
      const contentType = await this.getContentType(component);
      if (ARCHIVE_MIME_TYPES.has(contentType)) {
        const baseDir = component.getPackageRelativePath(baseName(content), 'source');
        this.createWriteInfosFromArchive(content, baseDir, result);
      } else {
        const extension = this.getExtensionFromType(contentType);
        result.writeInfos.push({
          source: component.tree.stream(content),
          relativeDestination: component.getPackageRelativePath(
            `${baseName(content)}.${extension}`,
            'source'
          ),
        });
      }

      result.writeInfos.push({
        source: component.tree.stream(xml),
        relativeDestination: component.getPackageRelativePath(basename(xml), 'source'),
      });
    }
    return result;
  }

  private async componentIsExpandedArchive(component: SourceComponent): Promise<boolean> {
    const { content, tree } = component;
    if (tree.isDirectory(content)) {
      const contentType = await this.getContentType(component);
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

  private async getContentType(component: SourceComponent): Promise<string> {
    return ((await component.parseXml()).StaticResource as JsonMap).contentType as string;
  }

  private getExtensionFromType(contentType: string): string {
    let ext = getExtension(contentType);
    if (!ext && FALLBACK_TYPE_MAP.get(contentType)) {
      ext = FALLBACK_TYPE_MAP.get(contentType);
    }
    // return registered ext, fallback, or the default (application/octet-stream -> bin)
    return ext || getExtension(DEFAULT_CONTENT_TYPE);
  }

  private createWriteInfosFromArchive(
    zipPath: string,
    destDir: string,
    format: WriterFormat
  ): void {
    // TODO: with async transformer methods, this workaround may not be necessary anymore.
    format.getExtraInfos = async (): Promise<WriteInfo[]> => {
      const writeInfos: WriteInfo[] = [];
      const directory = await Open.file(zipPath);
      directory.files.forEach((f) => {
        if (f.type === 'File') {
          writeInfos.push({
            source: f.stream(),
            relativeDestination: join(destDir, f.path),
          });
        }
      });
      return writeInfos;
    };
  }
}
