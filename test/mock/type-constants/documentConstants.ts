/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { join } from 'node:path';
import { registry, SourceComponent } from '../../../src';
import { META_XML_SUFFIX } from '../../../src/common';
import { extName } from '../../../src/utils';

const type = registry.types.document;

export const DOCUMENTS_DIRECTORY = join('path', 'to', type.directoryName);
export const COMPONENT_NAME = 'myDocument';
export const COMPONENT_SUFFIX = 'png';
export const COMPONENT_FOLDER_NAME = 'A_Folder';
export const COMPONENT_FOLDER_PATH = join(DOCUMENTS_DIRECTORY, COMPONENT_FOLDER_NAME);
export const CONTENT_PATH = join(DOCUMENTS_DIRECTORY, COMPONENT_FOLDER_NAME, COMPONENT_NAME + '.' + COMPONENT_SUFFIX);

export const XML_NAME = COMPONENT_NAME + '.' + COMPONENT_SUFFIX + META_XML_SUFFIX;
export const XML_PATH = join(COMPONENT_FOLDER_PATH, XML_NAME);
// Document types are converted from the original suffix to '.document' during source conversion.
export const CONVERTED_XML_PATH = XML_PATH.replace(extName(CONTENT_PATH), 'document');

export const COMPONENT = new SourceComponent({
  name: COMPONENT_FOLDER_NAME + '/' + COMPONENT_NAME,
  type,
  xml: XML_PATH,
  content: CONTENT_PATH,
});
export const COMPONENT_MD = new SourceComponent({
  name: COMPONENT_FOLDER_NAME + '/' + COMPONENT_NAME,
  type,
  xml: CONVERTED_XML_PATH,
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
