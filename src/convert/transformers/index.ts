import { MetadataTransformer, MetadataComponent } from '../../types';
import { DefaultTransformer } from './default';

export function getTransformer(component: MetadataComponent): MetadataTransformer {
  return new DefaultTransformer(component);
}
