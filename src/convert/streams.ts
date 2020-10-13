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
import { LibraryError } from '../errors';
import { SourceComponent, MetadataRegistry } from '../metadata-registry';
import { SfdxFileFormat, WriteInfo, WriterFormat } from './types';
import { ensureFileExists } from '../utils/fileSystemHandler';
import { ComponentSet, SourcePath } from '../common';
import { ConvertTransaction } from './convertTransaction';
import { MetadataTransformerFactory } from './transformers';
import { JsonMap } from '@salesforce/ts-types';
import { XML_DECL } from '../utils/constants';
import { j2xParser } from 'fast-xml-parser';
export const pipeline = promisify(cbPipeline);

export class ComponentReader extends Readable {
  private currentIndex = 0;
  private components: SourceComponent[];

  constructor(components: SourceComponent[]) {
    super({ objectMode: true });
    this.components = components;
  }

  public _read(): void {
    if (this.currentIndex < this.components.length) {
      const c = this.components[this.currentIndex];
      this.currentIndex += 1;
      this.push(c);
    } else {
      this.push(null);
    }
  }
}

export class ComponentConverter extends Transform {
  private targetFormat: SfdxFileFormat;
  private transaction: ConvertTransaction;
  private transformerFactory: MetadataTransformerFactory;
  private mergeSet: ComponentSet<SourceComponent>;

  constructor(
    targetFormat: SfdxFileFormat,
    registry: MetadataRegistry,
    transaction = new ConvertTransaction(),
    mergeSet?: ComponentSet<SourceComponent>
  ) {
    super({ objectMode: true });
    this.targetFormat = targetFormat;
    this.transaction = transaction;
    this.transformerFactory = new MetadataTransformerFactory(registry, this.transaction);
    this.mergeSet = mergeSet;
  }

  public async _transform(
    chunk: SourceComponent,
    encoding: string,
    callback: (err: Error, data: WriterFormat) => void
  ): Promise<void> {
    let err: Error;
    let result: WriterFormat;
    try {
      const transformer = this.transformerFactory.getTransformer(chunk);
      const componentToMergeAgainst = this.mergeSet?.get(chunk);
      switch (this.targetFormat) {
        case 'metadata':
          result = await transformer.toMetadataFormat(chunk);
          break;
        case 'source':
          result = await transformer.toSourceFormat(chunk, componentToMergeAgainst);
          break;
        default:
          throw new LibraryError('error_convert_invalid_format', this.targetFormat);
      }
    } catch (e) {
      err = e;
    }
    callback(err, result);
  }

  /**
   * Called at the end when all components have passed through the pipeline. Finalizers
   * take care of any additional work to be done at this stage e.g. recomposing child components.
   */
  public async _flush(callback: (err: Error, data?: WriterFormat) => void): Promise<void> {
    let err: Error;
    try {
      for await (const finalizerResult of this.transaction.executeFinalizers()) {
        if (finalizerResult) {
          if (Array.isArray(finalizerResult)) {
            finalizerResult.forEach((result) => this.push(result));
          } else {
            this.push(finalizerResult);
          }
        }
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
  constructor(rootDestination: SourcePath) {
    super(rootDestination);
  }

  public async _write(
    chunk: WriterFormat,
    encoding: string,
    callback: (err?: Error) => void
  ): Promise<void> {
    let err: Error;
    try {
      const infos = chunk.getExtraInfos ? await chunk.getExtraInfos() : [];
      infos.push(...chunk.writeInfos);

      const writeTasks = infos.map((info: WriteInfo) => {
        const fullDest = isAbsolute(info.output)
          ? info.output
          : join(this.rootDestination, info.output);
        ensureFileExists(fullDest);
        return pipeline(info.source, createWriteStream(fullDest));
      });
      // it is a reasonable expectation that when a conversion call exits, the files of
      // every component has been written to the destination. This await ensures the microtask
      // queue is empty when that call exits and overall less memory is consumed.
      await Promise.all(writeTasks);
    } catch (e) {
      err = e;
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
      const infos = chunk.getExtraInfos ? await chunk.getExtraInfos() : [];
      infos.push(...chunk.writeInfos);

      for (const writeInfo of infos) {
        this.addToZip(writeInfo.source, writeInfo.output);
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
