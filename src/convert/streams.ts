/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { basename, dirname, isAbsolute, join } from 'node:path';
import { pipeline as cbPipeline, Readable, Stream, Transform, Writable } from 'node:stream';
import { promisify } from 'node:util';
import { Messages, SfError } from '@salesforce/core';
import * as JSZip from 'jszip';
import { createWriteStream, existsSync } from 'graceful-fs';
import { JsonMap } from '@salesforce/ts-types';
import { XMLBuilder } from 'fast-xml-parser';
import { Logger } from '@salesforce/core';
import { SourceComponent } from '../resolve/sourceComponent';
import { MetadataResolver } from '../resolve/metadataResolver';
import { SourcePath } from '../common/types';
import { XML_DECL } from '../common/constants';
import { ComponentSet } from '../collections/componentSet';
import { RegistryAccess } from '../registry/registryAccess';
import { ensureFileExists } from '../utils/fileSystemHandler';
import { MetadataTransformerFactory } from './transformers/metadataTransformerFactory';
import { ConvertContext } from './convertContext/convertContext';
import { SfdxFileFormat, WriteInfo, WriterFormat } from './types';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/source-deploy-retrieve', 'sdr');

export const pipeline = promisify(cbPipeline);

export const stream2buffer = async (stream: Stream): Promise<Buffer> =>
  new Promise<Buffer>((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buf = Array<any>();
    stream.on('data', (chunk) => buf.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(buf)));
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    stream.on('error', (err) => reject(`error converting stream - ${err}`));
  });

export class ComponentConverter extends Transform {
  public readonly context = new ConvertContext();
  private transformerFactory: MetadataTransformerFactory;

  public constructor(
    private targetFormat: SfdxFileFormat,
    registry: RegistryAccess,
    private mergeSet?: ComponentSet,
    private defaultDirectory?: string
  ) {
    super({ objectMode: true });
    this.transformerFactory = new MetadataTransformerFactory(registry, this.context);
  }

  public async _transform(
    chunk: SourceComponent,
    encoding: string,
    callback: (err: Error | undefined, data: WriterFormat) => void
  ): Promise<void> {
    let err: Error | undefined;
    const writeInfos: WriteInfo[] = [];

    // Only transform components not marked for delete.
    if (!chunk.isMarkedForDelete()) {
      try {
        const converts: Array<Promise<WriteInfo[]>> = [];
        const transformer = this.transformerFactory.getTransformer(chunk);
        transformer.defaultDirectory = this.defaultDirectory;
        const mergeWith = this.mergeSet?.getSourceComponents(chunk);
        switch (this.targetFormat) {
          case 'source':
            if (mergeWith) {
              for (const mergeComponent of mergeWith) {
                converts.push(transformer.toSourceFormat(chunk, mergeComponent));
              }
            }
            if (converts.length === 0) {
              converts.push(transformer.toSourceFormat(chunk));
            }
            break;
          case 'metadata':
            converts.push(transformer.toMetadataFormat(chunk));
            break;
          default:
            throw new SfError(messages.getMessage('error_convert_invalid_format', [this.targetFormat]), 'LibraryError');
        }
        // could maybe improve all this with lazy async collections...
        (await Promise.all(converts)).forEach((infos) => writeInfos.push(...infos));
      } catch (e) {
        err = e as Error;
      }
    }

    callback(err, { component: chunk, writeInfos });
  }

  /**
   * Called at the end when all components have passed through the pipeline. Finalizers
   * take care of any additional work to be done at this stage e.g. recomposing child components.
   */
  public async _flush(callback: (err: Error | undefined, data?: WriterFormat) => void): Promise<void> {
    let err: Error | undefined;
    try {
      for await (const finalizerResult of this.context.executeFinalizers(this.defaultDirectory)) {
        finalizerResult.forEach((result) => this.push(result));
      }
    } catch (e) {
      err = e as Error;
    }
    callback(err);
  }
}

export abstract class ComponentWriter extends Writable {
  public forceIgnoredPaths: Set<string> = new Set<string>();
  protected rootDestination?: SourcePath;
  protected logger: Logger;

  public constructor(rootDestination?: SourcePath) {
    super({ objectMode: true });
    this.rootDestination = rootDestination;
    this.logger = Logger.childFromRoot(this.constructor.name);
  }
}

export class StandardWriter extends ComponentWriter {
  public converted: SourceComponent[] = [];

  public constructor(rootDestination: SourcePath, private resolver = new MetadataResolver()) {
    super(rootDestination);
  }

  public async _write(chunk: WriterFormat, encoding: string, callback: (err?: Error) => void): Promise<void> {
    let err: Error | undefined;
    if (chunk.writeInfos.length !== 0) {
      try {
        const toResolve: string[] = [];
        // it is a reasonable expectation that when a conversion call exits, the files of
        // every component has been written to the destination. This await ensures the microtask
        // queue is empty when that call exits and overall less memory is consumed.
        await Promise.all(
          chunk.writeInfos.map((info: WriteInfo) => {
            const fullDest = isAbsolute(info.output) ? info.output : join(this.rootDestination as string, info.output);
            if (!existsSync(fullDest)) {
              for (const ignoredPath of this.forceIgnoredPaths) {
                if (
                  dirname(ignoredPath).includes(dirname(fullDest)) &&
                  basename(ignoredPath).includes(basename(fullDest))
                ) {
                  return;
                }
              }
            }
            if (this.forceIgnoredPaths.has(fullDest)) {
              return;
            }
            // if there are children, resolve each file. o/w just pick one of the files to resolve
            if (toResolve.length === 0 || chunk.component.type.children) {
              // This is a workaround for a server side ListViews bug where
              // duplicate components are sent. W-9614275
              if (toResolve.includes(fullDest)) {
                this.logger.debug(`Ignoring duplicate metadata for: ${fullDest}`);
                return;
              }
              toResolve.push(fullDest);
            }
            ensureFileExists(fullDest);
            return pipeline(info.source, createWriteStream(fullDest));
          })
        );

        toResolve.map((fsPath) => {
          this.converted.push(...this.resolver.getComponentsFromPath(fsPath));
        });
      } catch (e) {
        err = e as Error;
      }
    }
    callback(err);
  }
}

export class ZipWriter extends ComponentWriter {
  private zip = JSZip();
  private zipBuffer?: Buffer;

  public constructor(rootDestination?: SourcePath) {
    super(rootDestination);
    const destination = rootDestination ? `for: ${rootDestination}` : 'in memory';
    this.logger.debug(`generating zip ${destination}`);
  }

  public get buffer(): Buffer | undefined {
    return this.zipBuffer;
  }

  public async _write(chunk: WriterFormat, encoding: string, callback: (err?: Error) => void): Promise<void> {
    let err: Error | undefined;
    try {
      await Promise.all(
        chunk.writeInfos.map(async (writeInfo) => {
          // we don't want to prematurely zip folder types when their children might still be not in the zip
          // those files we'll leave open as ReadableStreams until the zip finalizes
          if (Boolean(chunk.component.type.folderType) || Boolean(chunk.component.type.folderContentType)) {
            return this.addToZip(writeInfo.source, writeInfo.output);
          }
          // everything else can be zipped immediately to reduce the number of open files (windows has a low limit!) and help perf
          const streamAsBuffer = await stream2buffer(writeInfo.source);
          return this.addToZip(streamAsBuffer, writeInfo.output);
        })
      );
    } catch (e) {
      err = e as Error;
    }
    callback(err);
  }

  public async _final(callback: (err?: Error) => void): Promise<void> {
    let err: Error | undefined;
    try {
      this.zipBuffer = await this.zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 3 },
      });
      this.logger.debug('Generated zip complete');
    } catch (e) {
      err = e as Error;
    }
    callback(err);
  }

  public addToZip(contents: string | Readable | Buffer, path: SourcePath): void {
    // Ensure only posix paths are added to zip files
    const posixPath = path.replace(/\\/g, '/');
    this.zip.file(posixPath, contents);
  }
}

/**
 * Convenient wrapper to serialize a js object to XML content. Implemented as a stream
 * to be used as a valid source for ComponentWriters in the conversion pipeline,
 * even though it's not beneficial in the typical way a stream is.
 */
export class JsToXml extends Readable {
  public constructor(private xmlObject: JsonMap) {
    super();
  }

  public _read(): void {
    const builder = new XMLBuilder({
      format: true,
      indentBy: '    ',
      ignoreAttributes: false,
      cdataPropName: '__cdata',
    });

    const builtXml = String(builder.build(this.xmlObject));
    const xmlContent = XML_DECL.concat(handleSpecialEntities(builtXml));
    this.push(xmlContent);
    this.push(null);
  }
}

/**
 * use this function to handle special html entities.
 * XmlBuilder will otherwise replace ex: `&#160;` with `'&amp;#160;'` (escape the &)
 * This is a separate function to allow for future handling of other special entities
 *
 * See https://github.com/NaturalIntelligence/fast-xml-parser/blob/fa5a7339a5ae2ca4aea8a256179b82464dbf510e/docs/v4/5.Entities.md
 * The parser can call addEntities to support more, but the Builder does not have that option.
 * You also can't use Builder.tagValueProcessor to use this function
 * because the escaping of `&` happens AFTER that is called.
 * */
const handleSpecialEntities = (xml: string): string => xml.replaceAll('&amp;#160;', '&#160;');
