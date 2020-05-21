import { MetadataComponent } from '../../types';
import { WriterFormat } from '../defaultWriter';

export interface MetadataTransformer {
  toApiFormat(component: MetadataComponent): WriterFormat;
  toSourceFormat(component: MetadataComponent): WriterFormat;
}
