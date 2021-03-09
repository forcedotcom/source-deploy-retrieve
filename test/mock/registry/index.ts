/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { join } from 'path';
import { RegistryAccess } from '../../../src/metadata-registry';

export const mockRegistryData = {
  types: {
    /**
     * Metadata with no content and is contained in a folder type component
     *
     * e.g. Report in ReportFolder
     */
    xmlinfolder: {
      id: 'xmlinfolder',
      directoryName: 'xmlinfolders',
      inFolder: true,
      name: 'XmlInFolder',
      suffix: 'xif',
    },
    /**
     * Metadata with a content file that has the same suffix as the xml (minus the -meta.xml)
     *
     * e.g. ApexClass
     */
    matchingcontentfile: {
      id: 'matchingcontentfile',
      directoryName: 'matchingContentFiles',
      inFolder: false,
      name: 'MatchingContentFile',
      suffix: 'mcf',
      strategies: {
        adapter: 'matchingContentFile',
        transformer: 'standard',
      },
    },
    /**
     * Metadata with mixed content that requires replacement of the suffix.
     *
     * e.g. Document
     */
    document: {
      id: 'document',
      directoryName: 'documents',
      inFolder: true,
      name: 'Document',
      suffix: 'document',
      folderType: 'documentfolder',
      strategies: {
        adapter: 'mixedContent',
      },
    },
    /**
     * Metadata with content of any file type in a folder type component
     *
     * e.g. Document in DocumentFolder
     */
    mixedcontentinfolder: {
      id: 'mixedcontentinfolder',
      directoryName: 'mixedContentInFolders',
      inFolder: true,
      name: 'MixedContentInFolder',
      suffix: 'mcif',
      strictDirectoryName: true,
      folderType: 'mciffolder',
      strategies: {
        adapter: 'mixedContent',
      },
    },
    dwaynejohnson: {
      id: 'dwaynejohnson',
      directoryName: 'dwaynes',
      inFolder: false,
      name: 'DwayneJohnson',
      strictDirectoryName: true,
      strategies: {
        adapter: 'mixedContent',
      },
    },
    tarajihenson: {
      id: 'tarajihenson',
      directoryName: 'tarajis',
      inFolder: false,
      name: 'TarajiHenson',
      strictDirectoryName: true,
      strategies: {
        adapter: 'mixedContent',
      },
    },
    bundle: {
      id: 'bundle',
      directoryName: 'bundles',
      inFolder: false,
      name: 'Bundle',
      strictDirectoryName: true,
      strategies: {
        adapter: 'bundle',
        transformer: 'bundle',
      },
    },
    mciffolder: {
      id: 'mciffolder',
      directoryName: 'mixedContentInFolders',
      inFolder: false,
      name: 'McifFolder',
      suffix: 'mcifFolder',
      folderContentType: 'mixedcontentinfolder',
    },
    genewilder: {
      id: 'genewilder',
      directoryName: 'genes',
      inFolder: false,
      name: 'GeneWilder',
      suffix: 'gene',
      strategies: {
        adapter: 'badAdapterId',
        transformer: 'badAdapterId',
      },
    },
    reginaking: {
      id: 'reginaking',
      directoryName: 'reginas',
      inFolder: false,
      name: 'ReginaKing',
      suffix: 'regina',
      strictDirectoryName: true,
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
      strategies: {
        adapter: 'decomposed',
        transformer: 'decomposed',
        decomposition: 'folderPerType',
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
      strictDirectoryName: true,
      strategies: {
        adapter: 'mixedContent',
        transformer: 'staticResource',
      },
    },
    decomposedtoplevel: {
      id: 'decomposedtoplevel',
      directoryName: 'decomposedTopLevels',
      inFolder: false,
      name: 'DecomposedTopLevel',
      suffix: 'dtl',
      strictDirectoryName: true,
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
      strategies: {
        adapter: 'decomposed',
        transformer: 'decomposed',
        decomposition: 'topLevel',
      },
    },
  },
  suffixes: {
    xif: 'xmlinfolder',
    mcf: 'matchingcontentfile',
    missing: 'typewithoutdef',
    mcifFolder: 'mciffolder',
    genewilder: 'gene',
    reginaking: 'regina',
    sean: 'seanconnerys',
    mcif: 'mixedcontentinfolder',
    mixedSingleFile: 'mixedcontentsinglefile',
    dtl: 'decomposedtoplevel',
  },
  strictDirectoryNames: {
    dwaynes: 'dwaynejohnson',
    tarajis: 'tarajihenson',
    bundles: 'bundle',
    reginas: 'reginaking',
    mixedSingleFiles: 'mixedcontentsinglefile',
    mixedContentInFolders: 'mixedcontentinfolder',
    decomposedTopLevels: 'decomposedtoplevel',
  },
  childTypes: {
    x: 'reginaking',
    y: 'reginaking',
    g: 'decomposedtoplevel',
    badchildtype: 'mixedcontentsinglefile',
  },
  apiVersion: '48.0',
};

export const mockRegistry = new RegistryAccess(mockRegistryData);

import * as matchingContentFile from './matchingContentFileConstants';
import * as xmlInFolder from './xmlInFolderConstants';
import * as bundle from './bundleConstants';
import * as document from './documentConstants';
import * as taraji from './tarajiConstants';
import * as mixedContentInFolder from './mixedContentInFolderConstants';
import * as mixedContentSingleFile from './mixedContentSingleFileConstants';
import * as gene from './geneConstants';
import * as regina from './reginaConstants';
import * as sean from './seanConstants';
import * as decomposedtoplevel from './decomposedTopLevelConstants';
export {
  xmlInFolder,
  document,
  matchingContentFile,
  bundle,
  taraji,
  mixedContentInFolder,
  mixedContentSingleFile,
  gene,
  regina,
  sean,
  decomposedtoplevel,
};

// Mixed content
export const DWAYNE_DIR = join('path', 'to', 'dwaynes');
export const DWAYNE_XML_NAME = 'a.dwayne-meta.xml';
export const DWAYNE_XML = join(DWAYNE_DIR, DWAYNE_XML_NAME);
export const DWAYNE_SOURCE_NAME = 'a.xyz';
export const DWAYNE_SOURCE = join(DWAYNE_DIR, DWAYNE_SOURCE_NAME);
