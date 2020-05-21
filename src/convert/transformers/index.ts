import { MetadataComponent } from '../../types';
import { WriterFormat } from '../streams';

export interface MetadataTransformer {
  toApiFormat(component: MetadataComponent): WriterFormat;
  toSourceFormat(component: MetadataComponent): WriterFormat;
}
