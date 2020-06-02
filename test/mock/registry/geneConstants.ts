import { mockRegistry } from '.';
import { join } from 'path';
import { MetadataComponent } from '../../../src/types';

// Constants for a type that uses the BaseSourceAdapter and is inFolder
const type = mockRegistry.types.genewilder;

export const GENE_DIR = join('path', 'to', 'genes');
export const GENE_XML_NAME = 'a.gene-meta.xml';
export const GENE_XML_PATH = join(GENE_DIR, GENE_XML_NAME);
export const GENE_COMPONENT: MetadataComponent = {
  fullName: 'a',
  type,
  xml: GENE_XML_PATH,
  sources: []
};
