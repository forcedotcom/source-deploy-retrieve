import { Writable, pipeline as cbPipeline } from 'stream';
import { SourcePath, MetadataComponent } from '../types';
import { promisify } from 'util';
import { createWriteStream } from 'fs';
import { ensureFileExists } from '../utils/fileSystemHandler';
import { join } from 'path';

const pipeline = promisify(cbPipeline);

export type WriteInfo = {
  relativeDestination: SourcePath;
  source: NodeJS.ReadableStream;
};

export type WriterFormat = {
  component: MetadataComponent;
  writeInfos: WriteInfo[];
};

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
    for (const info of chunk.writeInfos) {
      const fullDest = join(this.rootDestination, info.relativeDestination);
      ensureFileExists(fullDest);
      writeTasks.push(
        pipeline(info.source, createWriteStream(fullDest)).then(() =>
          this.emit('convert', chunk.component)
        )
      );
    }
    // the write of a component isn't considered finished until all the sub jobs are done,
    // so wait here until they are. otherwise the macrotask may report the conversion as done
    // before all the file writes are finished in the microtask queue.
    await Promise.all(writeTasks);
    callback();
  }
}
