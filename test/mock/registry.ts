/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { join } from 'path';

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
    simons: 'simonpegg'
  },
  adapters: {
    keanureeves: 'matchingContentFile',
    tarajihenson: 'mixedContent',
    dwaynejohnson: 'mixedContent',
    simonpegg: 'bundle'
  }
};

// Matching content file
export const KEANUS_DIR = join('path', 'to', 'keanus');
export const KEANU_XML = join(KEANUS_DIR, 'a.keanu-meta.xml');
export const KEANU_SOURCE = join(KEANUS_DIR, 'a.keanu');
export const KEANU_COMPONENT = {
  fullName: 'a',
  type: mockRegistry.types.keanureeves,
  metaXml: KEANU_XML,
  sources: [KEANU_SOURCE]
};

// Mixed content
export const DWAYNE_DIR = join('path', 'to', 'dwaynes');
export const DWAYNE_XML = join(DWAYNE_DIR, 'a.dwayne-meta.xml');
export const DWAYNE_SOURCE = join(DWAYNE_DIR, 'a.xyz');

// Mixed content with directory as content
export const TARAJI_DIR = join('path', 'to', 'tarajis');
export const TARAJI_XML = join(TARAJI_DIR, 'a.taraji-meta.xml');
export const TARAJI_CONTENT = join(TARAJI_DIR, 'a');
export const TARAJI_SOURCE_1 = join(TARAJI_CONTENT, 'test.xyz');
export const TARAJI_SOURCE_2 = join(TARAJI_CONTENT, 'b', 'test.g');
export const TARAJI_SOURCE_3 = join(TARAJI_CONTENT, 'b', 'test2.w');
export const TARAJI_COMPONENT = {
  fullName: 'a',
  type: mockRegistry.types.tarajihenson,
  metaXml: TARAJI_XML,
  sources: [TARAJI_SOURCE_1, TARAJI_SOURCE_2, TARAJI_SOURCE_3]
};

// Bundle content
export const SIMON_DIR = join('path', 'to', 'simons');
export const SIMON_BUNDLE = join(SIMON_DIR, 'a');
export const SIMON_XML = join(SIMON_BUNDLE, 'a.js-meta.xml');
export const SIMON_SOURCE_1 = join(SIMON_BUNDLE, 'a.js');
export const SIMON_SOURCE_2 = join(SIMON_BUNDLE, 'a.css');
export const SIMON_SOURCE_3 = join(SIMON_BUNDLE, 'a.html');
