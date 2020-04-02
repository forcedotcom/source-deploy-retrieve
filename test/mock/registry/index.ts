/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { join } from 'path';
import { MetadataComponent } from '../../../src/metadata-registry/types';

export const mockRegistry = {
  types: {
    kathybates: {
      directoryName: 'kathys',
      inFolder: true,
      name: 'KathyBates',
      suffix: 'kathy'
    },
    keanureeves: {
      directoryName: 'keanus',
      inFolder: false,
      name: 'KeanuReeves',
      suffix: 'keanu'
    },
    tinafey: {
      directoryName: 'tinas',
      inFolder: true,
      name: 'TinaFey'
    },
    dwaynejohnson: {
      directoryName: 'dwaynes',
      inFolder: false,
      name: 'DwayneJohnson'
    },
    tarajihenson: {
      directoryName: 'tarajis',
      inFolder: false,
      name: 'TarajiHenson'
    },
    simonpegg: {
      directoryName: 'simons',
      inFolder: false,
      name: 'SimonPegg'
    }
  },
  suffixes: {
    kathy: 'kathybates',
    keanu: 'keanureeves',
    missing: 'typewithoutdef'
  },
  mixedContent: {
    dwaynes: 'dwaynejohnson',
    tarajis: 'tarajihenson',
    simons: 'simonpegg',
    tinas: 'tinafey'
  },
  adapters: {
    keanureeves: 'matchingContentFile',
    tinafey: 'mixedContent',
    tarajihenson: 'mixedContent',
    dwaynejohnson: 'mixedContent',
    simonpegg: 'bundle'
  }
};

import * as keanu from './keanuConstants';
import * as kathy from './kathyConstants';
import * as simon from './simonConstants';
import * as taraji from './tarajiConstants';
import * as tina from './tinaConstants';
export { kathy, keanu, simon, taraji, tina };

// Base functionality
export const KATHYS_DIR = join('path', 'to', 'kathys');
export const KATHY_FOLDER = join(KATHYS_DIR, 'A_Folder');
export const KATHY_XML = join(KATHY_FOLDER, 'a.kathy-meta.xml');
export const KATHY_XML_2 = join(KATHY_FOLDER, 'b.kathy-meta.xml');
export const KATHY_XML_3 = join(KATHY_FOLDER, 'c.kathy-meta.xml');
export const KATHY_COMPONENT: MetadataComponent = {
  fullName: `A_Folder/a`,
  type: mockRegistry.types.kathybates,
  xml: KATHY_XML,
  sources: []
};
export const KATHY_COMPONENT_2: MetadataComponent = {
  fullName: 'b',
  type: mockRegistry.types.kathybates,
  xml: KATHY_XML_2,
  sources: []
};
export const KATHY_COMPONENT_3: MetadataComponent = {
  fullName: 'b',
  type: mockRegistry.types.kathybates,
  xml: KATHY_XML_3,
  sources: []
};

// Matching content file
export const KEANUS_DIR = join('path', 'to', 'keanus');
export const KEANU_XML = join(KEANUS_DIR, 'a.keanu-meta.xml');
export const KEANU_SOURCE = join(KEANUS_DIR, 'a.keanu');
export const KEANU_COMPONENT: MetadataComponent = {
  fullName: 'a',
  type: mockRegistry.types.keanureeves,
  xml: KEANU_XML,
  sources: [KEANU_SOURCE]
};

// Mixed content
export const DWAYNE_DIR = join('path', 'to', 'dwaynes');
export const DWAYNE_XML = join(DWAYNE_DIR, 'a.dwayne-meta.xml');
export const DWAYNE_SOURCE = join(DWAYNE_DIR, 'a.xyz');

// Mixed content type in folders
export const TINA_DIR = join('path', 'to', 'tinas');
export const TINA_FOLDER = join(TINA_DIR, 'A_Folder');
export const TINA_XML = join(TINA_FOLDER, 'a.tina-meta.xml');
export const TINA_XML_2 = join(TINA_FOLDER, 'b.tina-meta.xml');
export const TINA_SOURCE = join(TINA_FOLDER, 'a.x');
export const TINA_SOURCE_2 = join(TINA_FOLDER, 'b.y');
export const TINA_COMPONENT: MetadataComponent = {
  fullName: 'A_Folder/a',
  type: mockRegistry.types.tinafey,
  xml: TINA_XML,
  sources: [TINA_SOURCE]
};
export const TINA_COMPONENT_2: MetadataComponent = {
  fullName: 'A_Folder/a',
  type: mockRegistry.types.tinafey,
  xml: TINA_XML,
  sources: [TINA_SOURCE]
};

// Mixed content with directory as content
export const TARAJI_DIR = join('path', 'to', 'tarajis');
export const TARAJI_XML = join(TARAJI_DIR, 'a.taraji-meta.xml');
export const TARAJI_CONTENT = join(TARAJI_DIR, 'a');
export const TARAJI_SOURCE_1 = join(TARAJI_CONTENT, 'test.xyz');
export const TARAJI_SOURCE_2 = join(TARAJI_CONTENT, 'b', 'test.g');
export const TARAJI_SOURCE_3 = join(TARAJI_CONTENT, 'b', 'test2.w');
export const TARAJI_COMPONENT: MetadataComponent = {
  fullName: 'a',
  type: mockRegistry.types.tarajihenson,
  xml: TARAJI_XML,
  sources: [TARAJI_SOURCE_1, TARAJI_SOURCE_2, TARAJI_SOURCE_3]
};

// Bundle content
export const SIMON_DIR = join('path', 'to', 'simons');
export const SIMON_BUNDLE = join(SIMON_DIR, 'a');
export const SIMON_XML = join(SIMON_BUNDLE, 'a.js-meta.xml');
export const SIMON_SUBTYPE = join(SIMON_BUNDLE, 'b.z-meta.xml');
export const SIMON_SOURCE_1 = join(SIMON_BUNDLE, 'a.js');
export const SIMON_SOURCE_2 = join(SIMON_BUNDLE, 'a.css');
export const SIMON_SOURCE_3 = join(SIMON_BUNDLE, 'a.html');
export const SIMON_COMPONENT: MetadataComponent = {
  fullName: 'a',
  type: mockRegistry.types.simonpegg,
  xml: SIMON_XML,
  sources: [SIMON_SOURCE_1, SIMON_SOURCE_2, SIMON_SOURCE_3]
};
