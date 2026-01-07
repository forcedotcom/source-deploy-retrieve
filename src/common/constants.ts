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

export const DEFAULT_PACKAGE_ROOT_SFDX = join('main', 'default');
export const META_XML_SUFFIX = '-meta.xml';
export const XML_DECL = '<?xml version="1.0" encoding="UTF-8"?>\n';
export const XML_NS_URL = 'http://soap.sforce.com/2006/04/metadata';
export const XML_NS_KEY = '@_xmlns';
export const XML_COMMENT_PROP_NAME = '#xml__comment';
