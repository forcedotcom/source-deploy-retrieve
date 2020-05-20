import { Transform } from 'stream';
import { MetadataComponent, ConversionType } from '../types';
import { sep } from 'path';
import { META_XML_SUFFIX } from '../utils';
import { createReadStream } from 'fs';
import { WriterFormat } from './defaultWriter';

/**
 * The default metadata transformer.
 *
 * If a metadata type doesn't have a transformer assigned to it, this transformer
 * is used during the conversion process. It leaves the component's metadata xml and
 * source files as-is. Other transformers should extend this one and override the
 * `toApiFormat` and `toSourceFormat` methods.
 */
export class DefaultTransformer extends Transform {
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
    try {
      switch (this.conversionType) {
        case 'toApi':
          result = this.toApiFormat(chunk);
          break;
        case 'toSource':
          result = this.toSourceFormat(chunk);
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

  protected toApiFormat(component: MetadataComponent): WriterFormat {
    const result: WriterFormat = { component, writeInfos: [] };
    const { directoryName } = component.type;
    let xmlDest = this.trimUntil(component.xml, directoryName);
    if (component.sources.length === 0) {
      xmlDest = xmlDest.slice(0, xmlDest.lastIndexOf(META_XML_SUFFIX));
    }
    result.writeInfos.push({
      source: createReadStream(component.xml),
      relativeDestination: xmlDest
    });
    // variable, can this be improved?
    for (const source of component.sources) {
      result.writeInfos.push({
        source: createReadStream(source),
        relativeDestination: this.trimUntil(source, directoryName)
      });
    }
    return result;
  }

  protected toSourceFormat(component: MetadataComponent): WriterFormat {
    // TODO: Improve error
    throw new Error('Source format conversion not yet supported');
  }

  protected trimUntil(path: string, name: string): string {
    const parts = path.split(sep);
    const index = parts.findIndex(part => name === part);
    if (index !== -1) {
      return parts.slice(index).join(sep);
    }
    return path;
  }
}
