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
      id: 'kathybates',
      directoryName: 'kathys',
      inFolder: true,
      name: 'KathyBates',
      suffix: 'kathy'
    },
    keanureeves: {
      id: 'keanureeves',
      directoryName: 'keanus',
      inFolder: false,
      name: 'KeanuReeves',
      suffix: 'keanu'
    },
    tinafey: {
      id: 'tinafey',
      directoryName: 'tinas',
      inFolder: true,
      name: 'TinaFey'
    },
    dwaynejohnson: {
      id: 'dwaynejohnson',
      directoryName: 'dwaynes',
      inFolder: false,
      name: 'DwayneJohnson'
    },
    tarajihenson: {
      id: 'tarajihenson',
      directoryName: 'tarajis',
      inFolder: false,
      name: 'TarajiHenson'
    },
    simonpegg: {
      id: 'simonpegg',
      directoryName: 'simons',
      inFolder: false,
      name: 'SimonPegg'
    },
    tinafeyfolder: {
      id: 'tinafeyfolder',
      directoryName: 'tinas',
      inFolder: false,
      name: 'TinaFeyFolder',
      suffix: 'tinafeyFolder'
    },
    genewilder: {
      id: 'genewilder',
      directoryName: 'genes',
      inFolder: false,
      name: 'GeneWilder',
      suffix: 'gene'
    },
    reginaking: {
      id: 'reginaking',
      directoryName: 'reginas',
      inFolder: false,
      name: 'ReginaKing',
      suffix: 'regina',
      children: {
        types: {
          x: {
            id: 'x',
            directoryName: 'xs',
            name: 'X',
            suffix: 'x'
          },
          y: {
            id: 'y',
            name: 'Y',
            suffix: 'y'
          }
        },
        suffixes: {
          x: 'x',
          y: 'y'
        }
      }
    }
  },
  suffixes: {
    kathy: 'kathybates',
    keanu: 'keanureeves',
    missing: 'typewithoutdef',
    tinafeyFolder: 'tinafeyfolder',
    genewilder: 'gene',
    reginaking: 'regina'
  },
  mixedContent: {
    dwaynes: 'dwaynejohnson',
    tarajis: 'tarajihenson',
    simons: 'simonpegg',
    tinas: 'tinafey',
    reginas: 'reginaking'
  },
  strategies: {
    keanureeves: { adapter: 'matchingContentFile', transformer: 'standard' },
    tinafey: { adapter: 'mixedContent', transformer: 'mixedContent' },
    tarajihenson: { adapter: 'mixedContent', transformer: 'mixedContent' },
    dwaynejohnson: { adapter: 'mixedContent', transformer: 'mixedContent' },
    simonpegg: { adapter: 'bundle', transformer: 'bundle' },
    reginaking: { adapter: 'decomposed', transformer: 'decomposed' },
    genewilder: { adapter: 'badAdapterId', transformer: 'badAdapterId' }
  },
  apiVersion: '48.0'
};

import * as keanu from './keanuConstants';
import * as kathy from './kathyConstants';
import * as simon from './simonConstants';
import * as taraji from './tarajiConstants';
import * as tina from './tinaConstants';
import * as gene from './geneConstants';
import * as regina from './reginaConstants';
export { kathy, keanu, simon, taraji, tina, gene, regina };

// Mixed content
export const DWAYNE_DIR = join('path', 'to', 'dwaynes');
export const DWAYNE_XML_NAME = 'a.dwayne-meta.xml';
export const DWAYNE_XML = join(DWAYNE_DIR, DWAYNE_XML_NAME);
export const DWAYNE_SOURCE_NAME = 'a.xyz';
export const DWAYNE_SOURCE = join(DWAYNE_DIR, DWAYNE_SOURCE_NAME);
