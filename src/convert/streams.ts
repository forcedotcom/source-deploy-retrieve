/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Archiver, create as createArchive } from 'archiver';
import { createWriteStream } from 'fs';
import { isAbsolute, join } from 'path';
import { pipeline as cbPipeline, Readable, Transform, Writable } from 'stream';
import { promisify } from 'util';
import { SourceComponent, MetadataResolver } from '../resolve';
import { SfdxFileFormat, WriteInfo, WriterFormat } from './types';
import { ensureFileExists } from '../utils/fileSystemHandler';
import { SourcePath, XML_DECL } from '../common';
import { ConvertContext } from './convertContext';
import { MetadataTransformerFactory } from './transformers';
import { JsonMap } from '@salesforce/ts-types';
import { j2xParser } from 'fast-xml-parser';
import { ComponentSet } from '../collections';
import { LibraryError } from '../errors';
import { RegistryAccess } from '../registry';
export const pipeline = promisify(cbPipeline);

export class ComponentReader extends Readable {
  private iter: Iterator<SourceComponent>;

  constructor(components: Iterable<SourceComponent>) {
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

  constructor(
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
    try {
      const converts: Promise<WriteInfo[]>[] = [];
      const transformer = this.transformerFactory.getTransformer(chunk);
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
          throw new LibraryError('error_convert_invalid_format', this.targetFormat);
      }
      // could maybe improve all this with lazy async collections...
      (await Promise.all(converts)).forEach((infos) => writeInfos.push(...infos));
    } catch (e) {
      err = e;
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
      err = e;
    }
    callback(err);
  }
}

export abstract class ComponentWriter extends Writable {
  protected rootDestination?: SourcePath;

  constructor(rootDestination?: SourcePath) {
    super({ objectMode: true });
    this.rootDestination = rootDestination;
  }
}

export class StandardWriter extends ComponentWriter {
  public converted: SourceComponent[] = [];
  private resolver: MetadataResolver;

  constructor(rootDestination: SourcePath, resolver = new MetadataResolver()) {
    super(rootDestination);
    this.resolver = resolver;
  }

  public async _write(
    chunk: WriterFormat,
    encoding: string,
    callback: (err?: Error) => void
  ): Promise<void> {
    let err: Error;
    if (chunk.writeInfos.length !== 0) {
      try {
        const toResolve: string[] = [];
        const writeTasks = chunk.writeInfos.map((info: WriteInfo) => {
          const fullDest = isAbsolute(info.output)
            ? info.output
            : join(this.rootDestination, info.output);
          // if there are children, resolve each file. o/w just pick one of the files to resolve
          if (toResolve.length === 0 || chunk.component.type.children) {
            toResolve.push(fullDest);
          }
          ensureFileExists(fullDest);
          return pipeline(info.source, createWriteStream(fullDest));
        });

        // it is a reasonable expectation that when a conversion call exits, the files of
        // every component has been written to the destination. This await ensures the microtask
        // queue is empty when that call exits and overall less memory is consumed.
        await Promise.all(writeTasks);

        for (const fsPath of toResolve) {
          this.converted.push(...this.resolver.getComponentsFromPath(fsPath));
        }
      } catch (e) {
        err = e;
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

  constructor(rootDestination?: SourcePath) {
    super(rootDestination);
    pipeline(this.zip, this.getOutputStream());
  }

  public async _write(
    chunk: WriterFormat,
    encoding: string,
    callback: (err?: Error) => void
  ): Promise<void> {
    let err: Error;
    try {
      for (const info of chunk.writeInfos) {
        this.addToZip(info.source, info.output);
      }
    } catch (e) {
      err = e;
    }
    callback(err);
  }

  public async _final(callback: (err?: Error) => void): Promise<void> {
    let err: Error;
    try {
      await this.zip.finalize();
    } catch (e) {
      err = e;
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
      bufferWritable._write = (chunk: Buffer, encoding: string, cb: () => void): void => {
        this.buffers.push(chunk);
        cb();
      };
      return bufferWritable;
    }
  }

  get buffer(): Buffer | undefined {
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

  constructor(xmlObject: JsonMap) {
    super();
    this.xmlObject = xmlObject;
  }

  public _read(): void {
    const js2Xml = new j2xParser({ format: true, indentBy: '    ', ignoreAttributes: false });
    const xmlContent = XML_DECL.concat(js2Xml.parse(this.xmlObject));
    this.push(xmlContent);
    this.push(null);
  }
}
