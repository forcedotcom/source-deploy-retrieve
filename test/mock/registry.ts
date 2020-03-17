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
  adapters: {}
};

// Matching content file
export const KEANUS_DIR = join('path', 'to', 'keanus');
export const KEANU_XML = join(KEANUS_DIR, 'a.keanu-meta.xml');
export const KEANU_SOURCE = join(KEANUS_DIR, 'a.keanu');

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
