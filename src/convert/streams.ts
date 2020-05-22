import { Readable, Transform, Writable } from 'stream';
import { MetadataComponent, SourcePath } from '../types';
import { DefaultTransformer } from './transformers/default';
import { join } from 'path';
import { ensureFileExists } from '../utils/fileSystemHandler';
import { createWriteStream } from 'fs';
import { pipeline } from '.';
import { ConversionError, LibraryError } from '../errors';

type ConversionType = 'toApi' | 'toSource';
type WriteInfo = { relativeDestination: SourcePath; source: NodeJS.ReadableStream };
export type WriterFormat = { component: MetadataComponent; writeInfos: WriteInfo[] };

export class ComponentReader extends Readable {
  private components: MetadataComponent[];
  private i = 0;

  constructor(components: MetadataComponent[]) {
    super({ objectMode: true });
    this.components = components;
  }

  _read(): void {
    if (this.i < this.components.length - 1) {
      const c = this.components[this.i];
      this.i += 1;
      this.push(c);
    } else {
      this.push(null);
    }
  }
}

export class ComponentConverter extends Transform {
  private conversionType: ConversionType;

  constructor(conversionType: ConversionType) {
    super({ objectMode: true });
    this.conversionType = conversionType;
  }

  _transform(
    chunk: MetadataComponent,
    encoding: string,
    callback: (err: Error, data: WriterFormat) => void
  ): void {
    let result: WriterFormat;
    let err: Error;
    const transformer = new DefaultTransformer();
    try {
      switch (this.conversionType) {
        case 'toApi':
          result = transformer.toApiFormat(chunk);
          break;
        case 'toSource':
          result = transformer.toSourceFormat(chunk);
          break;
        default:
          throw new LibraryError('error_convert_invalid_format', this.conversionType);
      }
    } catch (e) {
      err = new ConversionError(e);
    }
    callback(err, result);
  }
}

export class DefaultWriter extends Writable {
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
      // queue is empty when that call exits.
      await Promise.all(writeTasks);
    } catch (e) {
      err = new ConversionError(e);
    }
    callback(err);
  }
}
