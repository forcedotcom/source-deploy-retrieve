/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { basename, dirname, isAbsolute, join } from 'path';
import { pipeline as cbPipeline, Readable, Stream, Transform, Writable } from 'stream';
import { promisify } from 'util';
import { Messages, SfError } from '@salesforce/core';
import { Archiver, create as createArchive } from 'archiver';
import { createWriteStream, existsSync } from 'graceful-fs';
import { JsonMap } from '@salesforce/ts-types';
import { j2xParser } from 'fast-xml-parser';
import { Logger } from '@salesforce/core';
import { MetadataResolver, SourceComponent } from '../resolve';
import { SourcePath, XML_DECL } from '../common';
import { ComponentSet } from '../collections';
import { RegistryAccess } from '../registry';
import { ensureFileExists } from '../utils/fileSystemHandler';
import { MetadataTransformerFactory } from './transformers';
import { ConvertContext } from './convertContext';
import { SfdxFileFormat, WriteInfo, WriterFormat } from './types';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.load('@salesforce/source-deploy-retrieve', 'sdr', ['error_convert_invalid_format']);

export const pipeline = promisify(cbPipeline);

export const stream2buffer = async (stream: Stream): Promise<Buffer> => {
  return new Promise<Buffer>((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buf = Array<any>();

    stream.on('data', (chunk) => buf.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(buf)));
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    stream.on('error', (err) => reject(`error converting stream - ${err}`));
  });
};
export class ComponentReader extends Readable {
  private iter: Iterator<SourceComponent>;

  public constructor(components: Iterable<SourceComponent>) {
    super({ objectMode: true });
    this.iter = this.createIterator(components);
  }

  public _read(): void {
    let next = this.iter.next();
    while (!next.done) {
      this.push(next.value);
      next = this.iter.next();
    }
    this.push(null);
  }

  private *createIterator(components: Iterable<SourceComponent>): Iterator<SourceComponent> {
    for (const component of components) {
      yield component;
    }
  }
}

export class ComponentConverter extends Transform {
  public readonly context = new ConvertContext();
  private targetFormat: SfdxFileFormat;
  private mergeSet: ComponentSet;
  private transformerFactory: MetadataTransformerFactory;
  private defaultDirectory: string;

  public constructor(
    targetFormat: SfdxFileFormat,
    registry: RegistryAccess,
    mergeSet?: ComponentSet,
    defaultDirectory?: string
  ) {
    super({ objectMode: true });
    this.targetFormat = targetFormat;
    this.mergeSet = mergeSet;
    this.transformerFactory = new MetadataTransformerFactory(registry, this.context);
    this.defaultDirectory = defaultDirectory;
  }

  public async _transform(
    chunk: SourceComponent,
    encoding: string,
    callback: (err: Error, data: WriterFormat) => void
  ): Promise<void> {
    let err: Error;
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
  public async _flush(callback: (err: Error, data?: WriterFormat) => void): Promise<void> {
    let err: Error;
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
  public forceIgnoredPaths?: Set<string> = new Set<string>();
  protected rootDestination?: SourcePath;

  public constructor(rootDestination?: SourcePath) {
    super({ objectMode: true });
    this.rootDestination = rootDestination;
  }
}

export class StandardWriter extends ComponentWriter {
  public converted: SourceComponent[] = [];
  private resolver: MetadataResolver;
  private logger: Logger;

  public constructor(rootDestination: SourcePath, resolver = new MetadataResolver()) {
    super(rootDestination);
    this.resolver = resolver;
    this.logger = Logger.childFromRoot(this.constructor.name);
  }

  public async _write(chunk: WriterFormat, encoding: string, callback: (err?: Error) => void): Promise<void> {
    let err: Error;
    if (chunk.writeInfos.length !== 0) {
      try {
        const toResolve: string[] = [];
        // it is a reasonable expectation that when a conversion call exits, the files of
        // every component has been written to the destination. This await ensures the microtask
        // queue is empty when that call exits and overall less memory is consumed.
        await Promise.all(
          chunk.writeInfos.map((info: WriteInfo) => {
            const fullDest = isAbsolute(info.output) ? info.output : join(this.rootDestination, info.output);
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
  // compression-/speed+ (0)<---(3)---------->(9) compression+/speed-
  // 3 appears to be a decent balance of compression and speed. It felt like
  // higher values = diminishing returns on compression and made conversion slower
  private zip: Archiver = createArchive('zip', { zlib: { level: 3 } });
  private buffers: Buffer[] = [];

  public constructor(rootDestination?: SourcePath) {
    super(rootDestination);
    void pipeline(this.zip, this.getOutputStream());
  }

  public async _write(chunk: WriterFormat, encoding: string, callback: (err?: Error) => void): Promise<void> {
    let err: Error;
    try {
      await Promise.all(
        chunk.writeInfos.map(async (writeInfo) =>
          this.addToZip(
            chunk.component.type.folderType ?? chunk.component.type.folderContentType
              ? // we don't want to prematurely zip folder types when their children might still be not in the zip
                // those files we'll leave held open as Readable until finalize
                writeInfo.source
              : // everything else can be zipped immediately
                await stream2buffer(writeInfo.source),
            writeInfo.output
          )
        )
      );
    } catch (e) {
      err = e as Error;
    }
    callback(err);
  }

  public async _final(callback: (err?: Error) => void): Promise<void> {
    let err: Error;
    try {
      await this.zip.finalize();
    } catch (e) {
      err = e as Error;
    }
    callback(err);
  }

  public addToZip(contents: string | Readable | Buffer, path: SourcePath): void {
    this.zip.append(contents, { name: path });
  }

  private getOutputStream(): Writable {
    if (this.rootDestination) {
      return createWriteStream(this.rootDestination);
    } else {
      const bufferWritable = new Writable();
      // eslint-disable-next-line no-underscore-dangle
      bufferWritable._write = (chunk: Buffer, encoding: string, cb: () => void): void => {
        this.buffers.push(chunk);
        cb();
      };
      return bufferWritable;
    }
  }

  public get buffer(): Buffer | undefined {
    return Buffer.concat(this.buffers);
  }
}

/**
 * Convenient wrapper to serialize a js object to XML content. Implemented as a stream
 * to be used as a valid source for ComponentWriters in the conversion pipeline,
 * even though it's not beneficial in the typical way a stream is.
 */
export class JsToXml extends Readable {
  private xmlObject: JsonMap;

  public constructor(xmlObject: JsonMap) {
    super();
    this.xmlObject = xmlObject;
  }

  public _read(): void {
    const js2Xml = new j2xParser({ format: true, indentBy: '    ', ignoreAttributes: false, cdataTagName: '__cdata' });
    const xmlContent = XML_DECL.concat(js2Xml.parse(this.xmlObject));
    this.push(xmlContent);
    this.push(null);
  }
}
