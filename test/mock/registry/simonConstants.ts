import { mockRegistry } from '.';
import { join } from 'path';
import { MetadataComponent } from '../../../src/metadata-registry';

// Bundle content
const type = mockRegistry.types.simonpegg;

export const SIMON_DIR = join('path', 'to', 'simons');
export const SIMON_BUNDLE_PATH = join(SIMON_DIR, 'a');
export const SIMON_XML_PATH = join(SIMON_BUNDLE_PATH, 'a.js-meta.xml');
export const SIMON_SUBTYPE_PATH = join(SIMON_BUNDLE_PATH, 'b.z-meta.xml');
export const SIMON_SOURCE_PATHS = [
  join(SIMON_BUNDLE_PATH, 'a.js'),
  join(SIMON_BUNDLE_PATH, 'a.css'),
  join(SIMON_BUNDLE_PATH, 'a.html')
];
export const SIMON_COMPONENT: MetadataComponent = {
  fullName: 'a',
  type,
  xml: SIMON_XML_PATH,
  sources: SIMON_SOURCE_PATHS
};
