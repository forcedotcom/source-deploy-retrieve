import { Readable, Transform, Writable } from 'stream';
import { MetadataComponent, SourcePath } from '../types';
import { DefaultTransformer } from './transformers/default';
import { join } from 'path';
import { ensureFileExists } from '../utils/fileSystemHandler';
import { createWriteStream } from 'fs';
import { pipeline } from '.';

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

  _read(size: number): void {
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
          // TODO: Improve error
          throw new Error('unsupported conversion type');
      }
    } catch (e) {
      err = e;
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
    const writeTasks = [];
    let err: Error;
    try {
      for (const info of chunk.writeInfos) {
        const fullDest = join(this.rootDestination, info.relativeDestination);
        ensureFileExists(fullDest);
        writeTasks.push(pipeline(info.source, createWriteStream(fullDest)));
      }
      // the write of a component isn't considered finished until all the sub jobs are done,
      // so wait here until they are. otherwise the macrotask may report the conversion as done
      // before all the file writes are finished in the microtask queue.
      await Promise.all(writeTasks);
    } catch (e) {
      err = e;
    }
    callback(err);
  }
}
