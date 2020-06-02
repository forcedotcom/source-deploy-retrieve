/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Readable, Transform, Writable, pipeline as cbPipeline } from 'stream';
import { MetadataComponent, SourcePath, SfdxFileFormat, WriterFormat, WriteInfo } from '../types';
import { join } from 'path';
import { ensureFileExists } from '../utils/fileSystemHandler';
import { createWriteStream } from 'fs';
import { promisify } from 'util';
import { LibraryError } from '../errors';
import { getTransformer } from './transformers';

export const pipeline = promisify(cbPipeline);

export class ComponentReader extends Readable {
  private currentIndex = 0;
  private components: MetadataComponent[];

  constructor(components: MetadataComponent[]) {
    super({ objectMode: true });
    this.components = components;
  }

  _read(): void {
    if (this.currentIndex < this.components.length - 1) {
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

  constructor(targetFormat: SfdxFileFormat) {
    super({ objectMode: true });
    this.targetFormat = targetFormat;
  }

  _transform(
    chunk: MetadataComponent,
    encoding: string,
    callback: (err: Error, data: WriterFormat) => void
  ): void {
    let err: Error;
    let result: WriterFormat;
    try {
      const transformer = getTransformer(chunk);
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
}

export class StandardWriter extends Writable {
  private rootDestination: SourcePath;

  constructor(rootDestination: SourcePath) {
    super({ objectMode: true });
    this.rootDestination = rootDestination;
  }

  async _write(
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
