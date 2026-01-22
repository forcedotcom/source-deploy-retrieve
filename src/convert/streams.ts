/*
 * Copyright 2026, Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { isAbsolute, join } from 'node:path';
import { pipeline as cbPipeline, Readable, Transform, Writable, Stream } from 'node:stream';
import { promisify } from 'node:util';
import JSZip from 'jszip';
import { createWriteStream, existsSync, promises as fsPromises } from 'graceful-fs';
import { JsonMap } from '@salesforce/ts-types';
import { XMLBuilder } from 'fast-xml-parser';
import { Logger } from '@salesforce/core/logger';
import { SourceComponent } from '../resolve/sourceComponent';
import { SourcePath } from '../common/types';
import { XML_COMMENT_PROP_NAME, XML_DECL } from '../common/constants';
import { ComponentSet } from '../collections/componentSet';
import { RegistryAccess } from '../registry/registryAccess';
import { ensureFileExists } from '../utils/fileSystemHandler';
import { ComponentStatus, FileResponseSuccess } from '../client/types';
import { ForceIgnore } from '../resolve';
import { MetadataTransformerFactory } from './transformers/metadataTransformerFactory';
import { ConvertContext } from './convertContext/convertContext';
import { SfdxFileFormat, WriteInfo, WriterFormat } from './types';

export type PromisifiedPipeline = <T extends NodeJS.ReadableStream>(
  source: T,
  ...destinations: NodeJS.WritableStream[]
) => Promise<void>;

let promisifiedPipeline: PromisifiedPipeline | undefined; // store it so we don't have to promisify every time

export const getPipeline = (): PromisifiedPipeline => {
  promisifiedPipeline ??= promisify(cbPipeline);
  return promisifiedPipeline;
};

export const stream2buffer = async (stream: Stream): Promise<Buffer> =>
  new Promise<Buffer>((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buf = Array<any>();
    stream.on('data', (chunk) => buf.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(buf)));
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
        if (this.targetFormat === 'source') {
          const mergeWith = this.mergeSet?.getSourceComponents(chunk);
          if (mergeWith) {
            for (const mergeComponent of mergeWith) {
              converts.push(
                transformer.toSourceFormat({ component: chunk, mergeWith: mergeComponent, mergeSet: this.mergeSet })
              );
            }
          }
          if (converts.length === 0) {
            converts.push(transformer.toSourceFormat({ component: chunk, mergeSet: this.mergeSet }));
          }
        } else if (this.targetFormat === 'metadata') {
          converts.push(transformer.toMetadataFormat(chunk));
        }
        // could maybe improve all this with lazy async collections...
        const results = await Promise.all(converts);
        results.forEach((infos) => {
          writeInfos.push(...infos);
        });
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
  protected rootDestination?: SourcePath;
  protected logger: Logger;

  public constructor(rootDestination?: SourcePath) {
    super({ objectMode: true });
    this.rootDestination = rootDestination;
    this.logger = Logger.childFromRoot(this.constructor.name);
  }
}

export class StandardWriter extends ComponentWriter {
  /** filepaths that converted files were written to */
  public readonly converted: string[] = [];
  public readonly deleted: FileResponseSuccess[] = [];
  public readonly forceignore: ForceIgnore;

  public constructor(rootDestination: SourcePath) {
    super(rootDestination);
    this.forceignore = ForceIgnore.findAndCreate(rootDestination);
  }

  public async _write(chunk: WriterFormat, encoding: string, callback: (err?: Error) => void): Promise<void> {
    let err: Error | undefined;
    if (chunk.writeInfos.length !== 0) {
      try {
        const toResolve = new Set<string>();

        // it is a reasonable expectation that when a conversion call exits, the files of
        // every component has been written to the destination. This await ensures the microtask
        // queue is empty when that call exits and overall less memory is consumed.
        await Promise.all(
          chunk.writeInfos
            .map(makeWriteInfoAbsolute(this.rootDestination))
            .filter(existsOrDoesntMatchIgnored(this.forceignore, this.logger)) // Skip files matched by default ignore
            .map(async (info) => {
              if (info.shouldDelete) {
                this.deleted.push({
                  filePath: info.output,
                  state: ComponentStatus.Deleted,
                  type: info.type,
                  fullName: info.fullName,
                });
                return fsPromises.rm(info.output, { force: true, recursive: true });
              }

              // if there are children, resolve each file. o/w just pick one of the files to resolve
              // "resolve" means "make these show up in the FileResponses"
              if (
                toResolve.size === 0 ||
                chunk.component.type.children !== undefined ||
                // make each decomposed label show up in the fileResponses
                chunk.component.type.strategies?.transformer === 'decomposedLabels'
              ) {
                // This is a workaround for a server side ListViews bug where
                // duplicate components are sent. W-9614275
                if (toResolve.has(info.output)) {
                  this.logger.debug(`Ignoring duplicate metadata for: ${info.output}`);
                  return;
                }
                toResolve.add(info.output);
              }

              await ensureFileExists(info.output);
              return getPipeline()(info.source, createWriteStream(info.output));
            })
        );

        this.converted.push(...toResolve);
      } catch (e) {
        err = e as Error;
      }
    }
    callback(err);
  }
}

export class ZipWriter extends ComponentWriter {
  /**
   * Count of files (not directories) added to the zip file.
   */
  public fileCount: number = 0;
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
        chunk.writeInfos.filter(isWriteInfoWithSource).map(async (writeInfo) => {
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
    this.fileCount++;
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
      commentPropName: XML_COMMENT_PROP_NAME,
    });
    const builtXml = String(builder.build(this.xmlObject));
    const xmlContent = correctComments(XML_DECL.concat(handleSpecialEntities(builtXml)));
    this.push(xmlContent);
    this.push(null);
  }
}

/** xmlBuilder likes to add newline and indent before/after the comment (hypothesis: it uses `<` as a hint to newlint/indent) */
export const correctComments = (xml: string): string =>
  xml.includes('<!--') ? xml.replace(/\s+<!--(.*?)-->\s+/g, '<!--$1-->') : xml;
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
export const handleSpecialEntities = (xml: string): string => xml.replaceAll('&amp;#160;', '&#160;');

/** discriminate between the shouldDelete and the regular WriteInfo */
const isWriteInfoWithSource = (writeInfo: WriteInfo): writeInfo is WriteInfo & { source: Readable } =>
  writeInfo.source !== undefined;

const makeWriteInfoAbsolute =
  (rootDestination = '') =>
  (writeInfo: WriteInfo): WriteInfo => ({
    ...writeInfo,
    output: isAbsolute(writeInfo.output) ? writeInfo.output : join(rootDestination, writeInfo.output),
  });

const existsOrDoesntMatchIgnored =
  (forceignore: ForceIgnore, logger: Logger) =>
  (writeInfo: WriteInfo): boolean => {
    const result = existsSync(writeInfo.output) || forceignore.accepts(writeInfo.output);

    // Detect if file was ignored by .forceignore patterns
    if (!result) {
      logger.debug(`File ${writeInfo.output} was ignored or not exists`);
    }
    return result;
  };
