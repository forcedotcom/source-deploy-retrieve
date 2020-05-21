import { Transform } from 'stream';
import { MetadataComponent, ConversionType } from '../types';
import { WriterFormat } from './defaultWriter';
import { DefaultTransformer } from './transformers/defaultTransformer';

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
