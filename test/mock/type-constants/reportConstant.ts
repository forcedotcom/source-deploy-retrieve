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
import { basename, join } from 'node:path';

import { registry, SourceComponent } from '../../../src';
import { META_XML_SUFFIX } from '../../../src/common';

const type = registry.types.report;
const folderType = registry.types.reportfolder;

export const TYPE_DIRECTORY = join('path', 'to', type.directoryName);
export const COMPONENT_FOLDER_NAME = 'A_Folder';
export const COMPONENT_FOLDER_PATH = join(TYPE_DIRECTORY, COMPONENT_FOLDER_NAME);
export const COMPONENT_NAMES = ['a', 'b', 'c'];
export const XML_PATHS = COMPONENT_NAMES.map((name) =>
  join(COMPONENT_FOLDER_PATH, `${name}.${type.suffix}${META_XML_SUFFIX}`)
);
export const XML_NAMES = XML_PATHS.map((path) => basename(path));
export const XML_PATHS_MD_FORMAT = COMPONENT_NAMES.map((name) => join(COMPONENT_FOLDER_PATH, `${name}.${type.suffix}`));
export const COMPONENTS: SourceComponent[] = COMPONENT_NAMES.map(
  (name, index) =>
    new SourceComponent({
      name: `${COMPONENT_FOLDER_NAME}/${name}`,
      type,
      xml: XML_PATHS[index],
    })
);

export const FOLDER_XML_PATH = join(TYPE_DIRECTORY, `${COMPONENT_FOLDER_NAME}.${folderType.suffix}${META_XML_SUFFIX}`);
export const FOLDER_XML_NAME = basename(FOLDER_XML_PATH);
export const FOLDER_COMPONENT = new SourceComponent({
  name: COMPONENT_FOLDER_NAME,
  type: folderType,
  xml: FOLDER_XML_PATH,
});

export const COMPONENTS_MD_FORMAT: SourceComponent[] = COMPONENT_NAMES.map(
  (name, index) =>
    new SourceComponent({
      name: `${COMPONENT_FOLDER_NAME}/${name}`,
      type,
      xml: XML_PATHS_MD_FORMAT[index],
    })
);
export const FOLDER_COMPONENT_MD_FORMAT = new SourceComponent({
  name: COMPONENT_FOLDER_NAME,
  type: folderType,
  xml: join(TYPE_DIRECTORY, `${COMPONENT_FOLDER_NAME}${META_XML_SUFFIX}`),
});
