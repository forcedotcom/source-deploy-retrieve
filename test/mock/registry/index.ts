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

// Mixed content
export const DWAYNE_DIR = join('path', 'to', 'dwaynes');
export const DWAYNE_XML = join(DWAYNE_DIR, 'a.dwayne-meta.xml');
export const DWAYNE_SOURCE = join(DWAYNE_DIR, 'a.xyz');
