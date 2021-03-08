/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { basename, join } from 'path';
import { mockRegistryData } from '.';
import { SourceComponent } from '../../../src';
import { META_XML_SUFFIX } from '../../../src/common';

const type = mockRegistryData.types.document;

export const DOCUMENTS_DIRECTORY = join('path', 'to', type.directoryName);
export const COMPONENT_NAME = 'a';
export const COMPONENT_SUFFIX = 'png';
export const COMPONENT_FOLDER_NAME = 'A_Folder';
export const COMPONENT_FOLDER_PATH = join(DOCUMENTS_DIRECTORY, COMPONENT_FOLDER_NAME);
export const CONTENT_PATH = join(
  DOCUMENTS_DIRECTORY,
  COMPONENT_FOLDER_NAME,
  COMPONENT_NAME + '.' + COMPONENT_SUFFIX
);

export const XML_NAMES = [COMPONENT_NAME + '.' + COMPONENT_SUFFIX + META_XML_SUFFIX];
export const XML_PATHS = XML_NAMES.map((n) => join(COMPONENT_FOLDER_PATH, n));

export const COMPONENT: SourceComponent = new SourceComponent({
  name: join(COMPONENT_FOLDER_NAME, COMPONENT_NAME),
  type,
  xml: XML_PATHS[0],
  content: CONTENT_PATH,
});

export const COMPONENT_VIRTUAL_FS = [
  {
    dirPath: DOCUMENTS_DIRECTORY,
    children: [COMPONENT_FOLDER_NAME],
  },
  {
    dirPath: COMPONENT_FOLDER_PATH,
    children: [COMPONENT_NAME + '.' + COMPONENT_SUFFIX],
  },
];

export const CONVERTED_XML_PATH = join(
  COMPONENT_FOLDER_NAME,
  COMPONENT_NAME + '.' + type.suffix + META_XML_SUFFIX
);

// export const COMPONENT_ORIGINAL_SUFFIX = 'png';

// export const COMPONENT_NAMES = ['a.png', 'b.gif', 'c.pdf'];

// // From source to metadata (will have .png, etc.)
// export const XML_PATH = CONTENT_PATH + META_XML_SUFFIX;
// export const XML_PATH_MD_FORMAT = join(COMPONENT_FOLDER_PATH, COMPONENT_NAME + '.' + type.suffix);

// export const XML_PATHS = COMPONENT_NAMES.map((name) =>
//   join(COMPONENT_FOLDER_PATH, `${name}.png${META_XML_SUFFIX}`)
// );
// export const XML_NAMES = XML_PATHS.map((path) => basename(path));
// export const XML_PATHS_MD_FORMAT = COMPONENT_NAMES.map((name) =>
//   join(COMPONENT_FOLDER_PATH, `${name}.${type.suffix}`)
// );

// export const COMPONENT_VIRTUAL_FS = [
//   {
//     dirPath: DOCUMENTS_DIRECTORY,
//     children:

//   }
// ];
// export const COMPONENT_MD_FORMAT: SourceComponent = new SourceComponent({
//   name: COMPONENT_NAME,
//   type,
//   xml:
// });

// export const COMPONENTS_MD_FORMAT: SourceComponent[] = COMPONENT_NAMES.map(
//   (name, index) =>
//     new SourceComponent({
//       name: `${COMPONENT_FOLDER_NAME}/${name}`,
//       type,
//       xml: XML_PATHS_MD_FORMAT[index],
//     })
// );
