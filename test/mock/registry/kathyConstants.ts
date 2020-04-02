import { join } from 'path';
import { MetadataComponent } from '../../../src/metadata-registry';
import { mockRegistry } from '.';

// Constants for a type that uses the BaseSourceAdapter and is inFolder
const type = mockRegistry.types.kathybates;

export const KATHYS_DIR = join('path', 'to', 'kathys');
export const KATHY_FOLDER = join(KATHYS_DIR, 'A_Folder');
export const KATHY_XML_NAMES = [
  'a.kathy-meta.xml',
  'b.kathy-meta.xml',
  'c.kathy-meta.xml'
];
export const KATHY_XML_PATHS = [
  join(KATHY_FOLDER, 'a.kathy-meta.xml'),
  join(KATHY_FOLDER, 'b.kathy-meta.xml'),
  join(KATHY_FOLDER, 'c.kathy-meta.xml')
];
export const KATHY_COMPONENTS: MetadataComponent[] = [
  {
    fullName: `A_Folder/a`,
    type,
    xml: KATHY_XML_PATHS[0],
    sources: []
  },
  {
    fullName: 'A_Folder/b',
    type,
    xml: KATHY_XML_PATHS[1],
    sources: []
  },
  {
    fullName: 'A_Folder/c',
    type,
    xml: KATHY_XML_PATHS[2],
    sources: []
  }
];
