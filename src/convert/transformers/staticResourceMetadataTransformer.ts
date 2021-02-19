/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { BaseMetadataTransformer } from './baseMetadataTransformer';
import { WriteInfo } from '..';
import { create as createArchive } from 'archiver';
import { getExtension } from 'mime';
import { Open } from 'unzipper';
import { basename, dirname, join } from 'path';
import { baseName } from '../../utils';
import { JsonMap } from '@salesforce/ts-types';
import { Readable } from 'stream';
import { LibraryError } from '../../errors';
import { SourceComponent } from '../../metadata-registry';
import { SourcePath } from '../../common';

export class StaticResourceMetadataTransformer extends BaseMetadataTransformer {
  public static readonly ARCHIVE_MIME_TYPES = new Set([
    'application/zip',
    'application/x-zip-compressed',
    'application/jar',
  ]);
  private static readonly DEFAULT_CONTENT_TYPE = 'application/octet-stream';
  private static readonly FALLBACK_TYPE_MAP = new Map<string, string>([
    ['text/javascript', 'js'],
    ['application/x-javascript', 'js'],
    ['application/x-zip-compressed', 'zip'],
    ['text/x-haml', 'haml'],
    ['image/x-png', 'png'],
    ['text/xml', 'xml'],
  ]);

  public async toMetadataFormat(component: SourceComponent): Promise<WriteInfo[]> {
    const { content, type, xml } = component;

    let contentSource: Readable;

    if (await this.componentIsExpandedArchive(component)) {
      const zip = createArchive('zip', { zlib: { level: 3 } });
      zip.directory(content, false);
      zip.finalize();
      contentSource = zip;
    } else {
      contentSource = component.tree.stream(content);
    }

    return [
      {
        source: contentSource,
        output: join(type.directoryName, `${baseName(content)}.${type.suffix}`),
      },
      {
        source: component.tree.stream(xml),
        output: join(type.directoryName, basename(xml)),
      },
    ];
  }

  public async toSourceFormat(
    component: SourceComponent,
    mergeWith?: SourceComponent
  ): Promise<WriteInfo[]> {
    const { xml, content } = component;
    const writeInfos: WriteInfo[] = [];

    if (content) {
      const componentContentType = await this.getContentType(component);
      const mergeContentPath = mergeWith?.content;
      const baseContentPath = this.getBaseContentPath(component, mergeWith);

      // only unzip an archive component if there isn't a merge component, or the merge component is itself expanded
      const shouldUnzipArchive =
        StaticResourceMetadataTransformer.ARCHIVE_MIME_TYPES.has(componentContentType) &&
        (!mergeWith || mergeWith.tree.isDirectory(mergeContentPath));

      if (shouldUnzipArchive) {
        const zipBuffer = await component.tree.readFile(content);
        for await (const info of this.createWriteInfosFromArchive(zipBuffer, baseContentPath)) {
          writeInfos.push(info);
        }
      } else {
        const extension = this.getExtensionFromType(componentContentType);
        writeInfos.push({
          source: component.tree.stream(content),
          output: `${baseContentPath}.${extension}`,
        });
      }

      writeInfos.push({
        source: component.tree.stream(xml),
        output: mergeWith?.xml || component.getPackageRelativePath(basename(xml), 'source'),
      });
    }

    return writeInfos;
  }

  private getBaseContentPath(component: SourceComponent, mergeWith?: SourceComponent): SourcePath {
    const baseContentPath =
      mergeWith?.content || component.getPackageRelativePath(component.content, 'source');
    return join(dirname(baseContentPath), baseName(baseContentPath));
  }

  /**
   * "Expanded" refers to a component whose content file is a zip file, and its current
   * state is unzipped.
   */
  private async componentIsExpandedArchive(component: SourceComponent): Promise<boolean> {
    const { content, tree } = component;
    if (tree.isDirectory(content)) {
      const contentType = await this.getContentType(component);
      if (StaticResourceMetadataTransformer.ARCHIVE_MIME_TYPES.has(contentType)) {
        return true;
      }
      throw new LibraryError('error_static_resource_expected_archive_type', [
        contentType,
        component.name,
      ]);
    }
    return false;
  }

  private async *createWriteInfosFromArchive(
    zipBuffer: Buffer,
    baseDir: string
  ): AsyncIterable<WriteInfo> {
    const directory = await Open.buffer(zipBuffer);
    for (const entry of directory.files) {
      if (entry.type === 'File') {
        yield {
          source: entry.stream(),
          output: join(baseDir, entry.path),
        };
      }
    }
  }

  private async getContentType(component: SourceComponent): Promise<string> {
    return ((await component.parseXml()).StaticResource as JsonMap).contentType as string;
  }

  private getExtensionFromType(contentType: string): string {
    // return registered ext, fallback, or the default (application/octet-stream -> bin)
    return (
      getExtension(contentType) ||
      StaticResourceMetadataTransformer.FALLBACK_TYPE_MAP.get(contentType) ||
      getExtension(StaticResourceMetadataTransformer.DEFAULT_CONTENT_TYPE)
    );
  }
}
