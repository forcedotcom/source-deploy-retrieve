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

/** Filename suffix of the per-component metadata sidecar (`<name>.meta.json`). */
export const METADATA_SIDECAR_SUFFIX = '.meta.json';

/**
 * Handles any Data Cloud dataspace-scoped type whose layout nests a pair of JSON files per
 * component under a `d360/dataspace/<dataspace>/<typeDir>/` wrapper. This adapter is type-agnostic:
 * it derives everything from the path shape and the registered type, so onboarding a new
 * dataspace-scoped type is a registry change (a type entry + directory mapping), never a code change.
 *
 * Each component is TWO files: the payload `<name>.json` (the component's definition) and a sidecar
 * `<name>.meta.json` (`{ componentType, componentName, dataspaceName, retrieveWith, dependsOn }`).
 * There is no `-meta.xml`. The payload file is the component's content; the sidecar rides along as an
 * extra file (written by the transformer) and is NOT resolved as a separate component.
 *
 * The component fullName is dataspace-scoped: `<dataspace>.<name>` (matching how the CLI
 * addresses it, e.g. `<ComponentType>:<dataspace>.<name>`), where `<dataspace>` is the path
 * segment immediately above the type's directory.
 *
 * __Example Structure__ (`<typeDir>` is the registered `directoryName` of any dataspace-scoped type):
 *
 *```text
 * d360/dataspace/
 * ├── <dataspace>/
 * |   ├── <typeDir>/
 * |   |   ├── <name>.json                     -> <ComponentType>:<dataspace>.<name>
 * |   |   ├── <name>.meta.json                -> sidecar (not its own component)
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
    // The `<name>.meta.json` sidecar is part of its sibling payload component, not a component of
    // its own. Skip it here so resolution never yields a spurious component; the transformer emits
    // the sidecar alongside the payload. This exclusion is REQUIRED: `baseName` splits on the first
    // `.`, so `<name>.json` and `<name>.meta.json` both reduce to `<name>` — without it the sidecar
    // would resolve to the same dataspace-scoped name as the payload and collide.
    if (contentPath.endsWith(METADATA_SIDECAR_SUFFIX)) {
      return undefined;
    }
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
