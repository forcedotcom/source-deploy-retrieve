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
import { Messages } from '@salesforce/core/messages';
import { SfError } from '@salesforce/core/sfError';
import { SourcePath } from '../../common/types';
import { SourceComponent } from '../sourceComponent';
import { baseName } from '../../utils/path';
import { BundleSourceAdapter } from './bundleSourceAdapter';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/source-deploy-retrieve', 'sdr');

export class WebApplicationsSourceAdapter extends BundleSourceAdapter {
  // Enforces WebApplication bundle requirements for source/deploy while staying
  // compatible with metadata-only retrievals.
  protected populate(
    trigger: SourcePath,
    component?: SourceComponent,
    isResolvingSource = true
  ): SourceComponent | undefined {
    const source = super.populate(trigger, component);
    if (!source?.content) {
      return source;
    }

    const contentPath = source.content;
    const appName = baseName(contentPath);
    const expectedXmlPath = join(contentPath, `${appName}.webapplication-meta.xml`);
    if (!this.tree.exists(expectedXmlPath)) {
      throw new SfError(
        messages.getMessage('error_expected_source_files', [expectedXmlPath, this.type.name]),
        'ExpectedSourceFilesError'
      );
    }

    const resolvedSource =
      source.xml && source.xml === expectedXmlPath
        ? source
        : new SourceComponent(
            {
              name: source.name,
              type: source.type,
              content: source.content,
              xml: expectedXmlPath,
              parent: source.parent,
              parentType: source.parentType,
            },
            this.tree,
            this.forceIgnore
          );

    if (isResolvingSource) {
      const descriptorPath = join(contentPath, 'webapplication.json');
      const xmlFileName = `${appName}.webapplication-meta.xml`;
      const contentEntries = (this.tree.readDirectory(contentPath) ?? []).filter(
        (entry) => entry !== xmlFileName && entry !== 'webapplication.json'
      );
      if (contentEntries.length === 0) {
        // For deploy/source, we expect at least one non-metadata content file (e.g. index.html).
        throw new SfError(
          messages.getMessage('error_expected_source_files', [contentPath, this.type.name]),
          'ExpectedSourceFilesError'
        );
      }
      if (!this.tree.exists(descriptorPath)) {
        throw new SfError(
          messages.getMessage('error_expected_source_files', [descriptorPath, this.type.name]),
          'ExpectedSourceFilesError'
        );
      }
      if (this.forceIgnore.denies(descriptorPath)) {
        throw messages.createError('noSourceIgnore', [this.type.name, descriptorPath]);
      }
    }

    return resolvedSource;
  }
}
