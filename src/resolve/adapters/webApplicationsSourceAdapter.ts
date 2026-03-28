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
import { NodeFSTreeContainer } from '../treeContainers';
import { baseName } from '../../utils/path';
import { BundleSourceAdapter } from './bundleSourceAdapter';
import { validateWebApplicationJson } from './webApplicationValidation';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/source-deploy-retrieve', 'sdr');

/**
 * Source adapter for WebApplication bundles.
 *
 * webapplication.json is optional; validated on deploy, skipped on retrieve.
 */
export class WebApplicationsSourceAdapter extends BundleSourceAdapter {
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
    const expectedXmlPath = join(contentPath, `${appName}.uibundle-meta.xml`);
    if (!this.tree.exists(expectedXmlPath)) {
      throw new SfError(
        messages.getMessage('error_expected_source_files', [expectedXmlPath, this.type.name]),
        'ExpectedSourceFilesError'
      );
    }

    // Ensure the component always points at the canonical meta xml.
    const resolvedSource =
      source.xml && source.xml === expectedXmlPath
        ? source
        : new SourceComponent(
            {
              name: appName,
              type: source.type,
              content: source.content,
              xml: expectedXmlPath,
              parent: source.parent,
              parentType: source.parentType,
            },
            this.tree,
            this.forceIgnore
          );

    // Validate only on real filesystem; ZipTreeContainer (retrieve) doesn't support readFileSync.
    if (isResolvingSource && this.tree instanceof NodeFSTreeContainer) {
      const descriptorPath = join(contentPath, 'webapplication.json');
      const hasDescriptor = this.tree.exists(descriptorPath) && !this.forceIgnore.denies(descriptorPath);

      if (hasDescriptor) {
        const raw = this.tree.readFileSync(descriptorPath);
        validateWebApplicationJson(raw, descriptorPath, contentPath, this.tree);
      }
    }

    return resolvedSource;
  }
}
