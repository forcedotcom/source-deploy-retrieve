import { join } from 'path';
import { MetadataComponent } from '../../../src/metadata-registry';
import { mockRegistry } from '.';

// Constants for a matching content file type
const type = mockRegistry.types.keanureeves;

export const KEANUS_DIR = join('path', 'to', 'keanus');
export const KEANU_XML_NAMES = ['a.keanu-meta.xml', 'b.keanu-meta.xml'];
export const KEANU_SOURCE_NAMES = ['a.keanu', 'b.keanu'];
export const KEANU_XML_PATHS = KEANU_XML_NAMES.map(n => join(KEANUS_DIR, n));
export const KEANU_SOURCE_PATHS = KEANU_SOURCE_NAMES.map(n =>
  join(KEANUS_DIR, n)
);
export const KEANU_COMPONENT: MetadataComponent = {
  fullName: 'a',
  type,
  xml: KEANU_XML_PATHS[0],
  sources: [KEANU_SOURCE_PATHS[0]]
};
