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
import { assert } from 'chai';
import { registry, SourceComponent } from '../../../src';
import { META_XML_SUFFIX } from '../../../src/common';

export const DE_TYPE = registry.types.digitalexperiencebundle.children?.types.digitalexperience;
assert(DE_TYPE);
export const DEB_TYPE = registry.types.digitalexperiencebundle;

// metafile name = metaFileSuffix for DigitalExperience.
export const DE_METAFILE = DE_TYPE.metaFileSuffix;
assert(typeof DE_METAFILE === 'string');

export const BUNDLE_NAME = 'site/foo';
export const BUNDLE_FULL_NAME = BUNDLE_NAME;
export const HOME_VIEW_NAME = 'sfdc_cms__view/home';
export const HOME_VIEW_FULL_NAME = `${BUNDLE_FULL_NAME}.${HOME_VIEW_NAME}`;

export const BUNDLE_META_FILE = `foo.${DEB_TYPE.suffix}${META_XML_SUFFIX}`;
export const HOME_VIEW_META_FILE = DE_METAFILE;
export const HOME_VIEW_CONTENT_FILE = 'content.json';
export const HOME_VIEW_FRENCH_VARIANT_FILE = 'fr.json';

export const BASE_PATH = join('path', 'to', DEB_TYPE.directoryName);
export const BUNDLE_PATH = join(BASE_PATH, 'site', 'foo');
export const BUNDLE_META_FILE_PATH = join(BUNDLE_PATH, BUNDLE_META_FILE);
export const HOME_VIEW_PATH = join(BUNDLE_PATH, 'sfdc_cms__view', 'home');
export const HOME_VIEW_META_FILE_PATH = join(HOME_VIEW_PATH, DE_METAFILE);

// DigitalExperienceBundle component
export const DEB_COMPONENT = SourceComponent.createVirtualComponent(
  {
    name: BUNDLE_NAME,
    type: DEB_TYPE,
    xml: BUNDLE_META_FILE_PATH,
  },
  [
    {
      dirPath: BUNDLE_PATH,
      children: [BUNDLE_META_FILE],
    },
  ]
);

// DigitalExperience component
export const DE_COMPONENT = SourceComponent.createVirtualComponent(
  {
    name: HOME_VIEW_NAME,
    type: DE_TYPE,
    content: HOME_VIEW_PATH,
    xml: HOME_VIEW_META_FILE_PATH,
    parent: DEB_COMPONENT,
    parentType: DEB_TYPE,
  },
  [
    {
      dirPath: HOME_VIEW_PATH,
      children: [HOME_VIEW_CONTENT_FILE, HOME_VIEW_FRENCH_VARIANT_FILE, HOME_VIEW_META_FILE],
    },
  ]
);
