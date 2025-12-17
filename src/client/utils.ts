/*
 * Copyright 2025, Salesforce, Inc.
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
import { posix, sep } from 'node:path';
import { SourceComponent, SourceComponentWithContent } from '../resolve/sourceComponent';

export const isWebAppBundle = (component: SourceComponent): component is SourceComponentWithContent =>
  component.type.name === 'DigitalExperienceBundle' &&
  component.fullName.startsWith('web_app/') &&
  typeof component.content === 'string';

/**
 * Computes the path-based fullName for a file within a web_app bundle.
 * Example: /path/to/digitalExperiences/web_app/ReactDemo/src/App.jsx -> web_app/ReactDemo/src/App.jsx
 */
export const computeWebAppPathName = (filePath: string): string => {
  const pathParts = filePath.split(sep);
  const digitalExperiencesIndex = pathParts.indexOf('digitalExperiences');

  if (digitalExperiencesIndex === -1) {
    return filePath;
  }

  // Return path from baseType onwards (web_app/bundleName/file)
  // Always use forward slashes for metadata names
  return pathParts.slice(digitalExperiencesIndex + 1).join(posix.sep);
};
