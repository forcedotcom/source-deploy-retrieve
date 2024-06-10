/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { basename, join } from 'node:path';

import { registry, SourceComponent, VirtualTreeContainer } from '../../../src';
import { META_XML_SUFFIX } from '../../../src/common';

const type = registry.types.document;
const folderType = registry.types.documentfolder;

export const TYPE_DIRECTORY = join('path', 'to', type.directoryName);
export const COMPONENT_FOLDER_NAME = 'A_Folder';
export const COMPONENT_FOLDER_PATH = join(TYPE_DIRECTORY, COMPONENT_FOLDER_NAME);
export const COMPONENT_NAMES = ['comp1', 'comp2', 'comp3'];
const CONTENT_FILE_EXTS = ['json', 'csv', 'jpg'];

export const FOLDER_XML_PATH = join(TYPE_DIRECTORY, `${COMPONENT_FOLDER_NAME}.${folderType.suffix}${META_XML_SUFFIX}`);
export const FOLDER_XML_NAME = basename(FOLDER_XML_PATH);
export const FOLDER_XML_PATH_MD_FORMAT = join(TYPE_DIRECTORY, `${COMPONENT_FOLDER_NAME}${META_XML_SUFFIX}`);
export const XML_PATHS = COMPONENT_NAMES.map((name) =>
  join(COMPONENT_FOLDER_PATH, `${name}.${type.suffix}${META_XML_SUFFIX}`)
);
export const XML_NAMES = XML_PATHS.map((path) => basename(path));
export const CONTENT_PATHS = COMPONENT_NAMES.map((name, index) =>
  join(COMPONENT_FOLDER_PATH, `${name}.${CONTENT_FILE_EXTS[index]}`)
);
export const CONTENT_NAMES = CONTENT_PATHS.map((path) => basename(path));

const TREE = new VirtualTreeContainer([
  {
    dirPath: TYPE_DIRECTORY,
    children: [COMPONENT_FOLDER_NAME, FOLDER_XML_NAME],
  },
  {
    dirPath: COMPONENT_FOLDER_PATH,
    children: XML_NAMES.concat(CONTENT_NAMES),
  },
]);
export const FOLDER_COMPONENT = new SourceComponent(
  {
    name: COMPONENT_FOLDER_NAME,
    type: folderType,
    xml: FOLDER_XML_PATH,
  },
  TREE
);
export const FOLDER_COMPONENT_MD_FORMAT = new SourceComponent(
  {
    name: COMPONENT_FOLDER_NAME,
    type: folderType,
    xml: FOLDER_XML_PATH_MD_FORMAT,
  },
  TREE
);
export const COMPONENTS = COMPONENT_NAMES.map(
  (name, index) =>
    new SourceComponent(
      {
        name: `${COMPONENT_FOLDER_NAME}/${name}`,
        type,
        xml: XML_PATHS[index],
        content: CONTENT_PATHS[index],
      },
      TREE
    )
);
