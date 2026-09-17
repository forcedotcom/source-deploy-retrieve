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
import { sep } from 'node:path';
import { Messages } from '@salesforce/core/messages';
import { SfError } from '@salesforce/core/sfError';
import { baseName } from '../../utils/path';
import { SourcePath } from '../../common/types';
import { MetadataXml } from '../types';
import { SourceComponent } from '../sourceComponent';
import { MixedContentSourceAdapter } from './mixedContentSourceAdapter';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/source-deploy-retrieve', 'sdr');

/**
 * Handles Data Cloud dataspace-scoped types (CalculatedInsight, DataModelObject) whose
 * source-format layout nests a single JSON file per component under a `dataSpaces/<dataspace>/`
 * wrapper. Each component is a single self-contained `.json` file (a ComponentEnvelope of
 * `{ entityPayload, dependsOn }`) with no separate `-meta.xml`.
 *
 * The component fullName is dataspace-scoped: `<dataspace>.<name>` (matching how the CLI
 * addresses it, e.g. `CalculatedInsight:default.ciTest`), where `<dataspace>` is the path
 * segment immediately above the type's directory.
 *
 * __Example Structure__:
 *
 *```text
 * dataSpaces/
 * ├── default/
 * |   ├── calculatedInsights/
 * |   |   ├── ciTest.json          -> CalculatedInsight:default.ciTest
 * |   ├── dataModelObjects/
 * |   |   ├── account.json         -> DataModelObject:default.account
 *```
 */
export class DataspaceScopedSourceAdapter extends MixedContentSourceAdapter {
  // Each component is a single JSON file; there is no separate metadata xml.
  protected metadataWithContent = false;

  /**
   * The single JSON file IS the content, not a root metadata xml. Returning undefined here
   * (and from {@link getRootMetadataXmlPath}) ensures the base `getComponent` does NOT
   * pre-build a SourceComponent with a plain, non-dataspace-scoped name — instead `populate`
   * builds it with the correct `<dataspace>.<name>` fullName.
   */
  // eslint-disable-next-line class-methods-use-this
  protected parseAsRootMetadataXml(): MetadataXml | undefined {
    return undefined;
  }

  // eslint-disable-next-line class-methods-use-this
  protected getRootMetadataXmlPath(): SourcePath | undefined {
    return undefined;
  }

  protected populate(trigger: SourcePath, component?: SourceComponent): SourceComponent | undefined {
    const contentPath = this.trimPathToContent(trigger);
    if (!contentPath || !this.tree.exists(contentPath)) {
      throw new SfError(
        messages.getMessage('error_expected_source_files', [trigger, this.type.name]),
        'ExpectedSourceFilesError'
      );
    }

    const name = this.calculateDataspaceScopedName(contentPath);
    if (component) {
      component.content = contentPath;
    } else {
      component = new SourceComponent(
        {
          name,
          type: this.type,
          content: contentPath,
        },
        this.tree,
        this.forceIgnore
      );
    }
    return component;
  }

  /**
   * Build `<dataspace>.<name>` from a path shaped like
   * `.../dataSpaces/<dataspace>/<typeDir>/<name>.json`. The dataspace is the path segment
   * immediately preceding the type's directory.
   */
  private calculateDataspaceScopedName(contentPath: SourcePath): string {
    const pathParts = contentPath.split(sep);
    const typeFolderIndex = pathParts.lastIndexOf(this.type.directoryName);
    const dataspace = typeFolderIndex > 0 ? pathParts[typeFolderIndex - 1] : undefined;
    const shortName = baseName(contentPath);
    return dataspace ? `${dataspace}.${shortName}` : shortName;
  }
}
