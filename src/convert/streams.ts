/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Archiver, create as createArchive } from 'archiver';
import { createWriteStream } from 'fs';
import { join } from 'path';
import { pipeline as cbPipeline, Readable, Transform, Writable } from 'stream';
import { promisify } from 'util';
import { LibraryError } from '../errors';
import { SourceComponent } from '../metadata-registry';
import { SfdxFileFormat, WriteInfo, WriterFormat } from '../types';
import { ensureFileExists } from '../utils/fileSystemHandler';
import { SourcePath } from '../common';
import { ConvertTransaction } from './convertTransaction';
import { MetadataTransformerFactory } from './transformers';

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
  private transaction = new ConvertTransaction();
  private transformerFactory: MetadataTransformerFactory;

  constructor(targetFormat: SfdxFileFormat, registry: MetadataRegistry) {
    super({ objectMode: true });
    this.targetFormat = targetFormat;
    this.transformerFactory = new MetadataTransformerFactory(registry, this.transaction);
  }

  public _transform(
    chunk: SourceComponent,
    encoding: string,
    callback: (err: Error, data: WriterFormat) => void
  ): void {
    let err: Error;
    let result: WriterFormat;
    try {
      const transformer = this.transformerFactory.getTransformer(chunk);
      switch (this.targetFormat) {
        case 'metadata':
          result = transformer.toMetadataFormat();
          break;
        case 'source':
          result = transformer.toSourceFormat();
          break;
        default:
          throw new LibraryError('error_convert_invalid_format', this.targetFormat);
      }
    } catch (e) {
      err = e;
    }
    callback(err, result);
  }

  public _flush(callback: (err: Error, data?: WriterFormat) => void): void {
    let err: Error;
    try {
      for (const finalizerResult of this.transaction.executeFinalizers()) {
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
      const writeTasks = chunk.writeInfos.map((info: WriteInfo) => {
        const fullDest = join(this.rootDestination, info.relativeDestination);
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
      for (const writeInfo of chunk.writeInfos) {
        this.addToZip(writeInfo.source, writeInfo.relativeDestination);
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
