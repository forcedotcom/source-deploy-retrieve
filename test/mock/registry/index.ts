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
      suffix: 'kathy',
    },
    keanureeves: {
      id: 'keanureeves',
      directoryName: 'keanus',
      inFolder: false,
      name: 'KeanuReeves',
      suffix: 'keanu',
    },
    tinafey: {
      id: 'tinafey',
      directoryName: 'tinas',
      inFolder: true,
      name: 'TinaFey',
    },
    dwaynejohnson: {
      id: 'dwaynejohnson',
      directoryName: 'dwaynes',
      inFolder: false,
      name: 'DwayneJohnson',
    },
    tarajihenson: {
      id: 'tarajihenson',
      directoryName: 'tarajis',
      inFolder: false,
      name: 'TarajiHenson',
    },
    simonpegg: {
      id: 'simonpegg',
      directoryName: 'simons',
      inFolder: false,
      name: 'SimonPegg',
    },
    tinafeyfolder: {
      id: 'tinafeyfolder',
      directoryName: 'tinas',
      inFolder: false,
      name: 'TinaFeyFolder',
      suffix: 'tinafeyFolder',
    },
    genewilder: {
      id: 'genewilder',
      directoryName: 'genes',
      inFolder: false,
      name: 'GeneWilder',
      suffix: 'gene',
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
            suffix: 'x',
          },
          y: {
            id: 'y',
            directoryName: 'ys',
            name: 'Y',
            suffix: 'y',
          },
        },
        suffixes: {
          x: 'x',
          y: 'y',
        },
        directories: {
          xs: 'x',
          ys: 'y',
        },
      },
    },
    seanconnerys: {
      id: 'seanconnerys',
      directoryName: 'seans',
      inFolder: true,
      name: 'SeanConnery',
      suffix: 'sean',
    },
    seanfolder: {
      id: 'seanfolder',
      directoryName: 'seans',
      inFolder: false,
      name: 'SeanFolder',
      suffix: 'seanfolder',
    },
    mixedcontentsinglefile: {
      id: 'mixedcontentsinglefile',
      directoryName: 'mixedSingleFiles',
      inFolder: false,
      name: 'MixedContentSingleFile',
      suffix: 'mixedSingleFile',
    },
    decomposedtoplevel: {
      id: 'decomposedtoplevel',
      directoryName: 'decomposedTopLevels',
      inFolder: false,
      name: 'DecomposedTopLevel',
      suffix: 'dtl',
      children: {
        types: {
          g: {
            id: 'g',
            directoryName: 'gs',
            name: 'G',
            suffix: 'g',
          },
        },
        suffixes: {
          g: 'g',
        },
        directories: {
          gs: 'g',
        },
      },
    },
  },
  suffixes: {
    kathy: 'kathybates',
    keanu: 'keanureeves',
    missing: 'typewithoutdef',
    tinafeyFolder: 'tinafeyfolder',
    genewilder: 'gene',
    reginaking: 'regina',
    sean: 'seanconnerys',
    mixedSingleFile: 'mixedcontentsinglefile',
    dtl: 'decomposedtoplevel',
  },
  strictTypeFolder: {
    dwaynes: 'dwaynejohnson',
    tarajis: 'tarajihenson',
    simons: 'simonpegg',
    tinas: 'tinafey',
    reginas: 'reginaking',
    mixedSingleFiles: 'mixedcontentsinglefile',
    decomposedTopLevels: 'decomposedtoplevel',
  },
  strategies: {
    keanureeves: { adapter: 'matchingContentFile', transformer: 'standard' },
    tinafey: { adapter: 'mixedContent' },
    tarajihenson: { adapter: 'mixedContent' },
    dwaynejohnson: { adapter: 'mixedContent' },
    simonpegg: { adapter: 'bundle', transformer: 'bundle' },
    reginaking: {
      adapter: 'decomposed',
      transformer: 'decomposed',
      decomposition: 'folderPerType',
    },
    genewilder: { adapter: 'badAdapterId', transformer: 'badAdapterId' },
    mixedcontentsinglefile: { adapter: 'mixedContent', transformer: 'staticResource' },
    decomposedtoplevel: {
      adapter: 'decomposed',
      transformer: 'decomposed',
      decomposition: 'topLevel',
    },
  },
  apiVersion: '48.0',
};

import * as keanu from './keanuConstants';
import * as kathy from './kathyConstants';
import * as simon from './simonConstants';
import * as taraji from './tarajiConstants';
import * as tina from './tinaConstants';
import * as gene from './geneConstants';
import * as regina from './reginaConstants';
import * as sean from './seanConstants';
import * as decomposedtoplevel from './decomposedTopLevelConstants';
export { kathy, keanu, simon, taraji, tina, gene, regina, sean, decomposedtoplevel };

// Mixed content
export const DWAYNE_DIR = join('path', 'to', 'dwaynes');
export const DWAYNE_XML_NAME = 'a.dwayne-meta.xml';
export const DWAYNE_XML = join(DWAYNE_DIR, DWAYNE_XML_NAME);
export const DWAYNE_SOURCE_NAME = 'a.xyz';
export const DWAYNE_SOURCE = join(DWAYNE_DIR, DWAYNE_SOURCE_NAME);
