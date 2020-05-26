import { MetadataComponent } from '../../types';
import { WriterFormat } from '../streams';
export { DefaultTransformer } from './default';

/**
 * Transforms metadata component files into different SFDX file formats
 */
export interface MetadataTransformer {
  toMetadataFormat(component: MetadataComponent): WriterFormat;
  toSourceFormat(component: MetadataComponent): WriterFormat;
}
