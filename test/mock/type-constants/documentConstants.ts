/*
 * Copyright 2026, Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
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
