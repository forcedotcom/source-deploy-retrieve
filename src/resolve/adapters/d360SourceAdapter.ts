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

/** Folder every Data Cloud component is stored under, on disk and in the metadata package. */
export const D360_ROOT = 'd360';

/** Folder that wraps dataspace-scoped components: `d360/dataspace/<dataspace>/<typeDir>/`. */
const DATASPACE_FOLDER = 'dataspace';

/**
 * The part of a path from its `d360` folder down, for a file of the type stored in `typeDir`. The path
 * must be `.../d360/<typeDir>/<file>` or `.../d360/dataspace/<dataspace>/<typeDir>/<file>`; any other
 * shape returns undefined.
 */
export const getD360RelativePath = (fsPath: SourcePath, typeDir: string): SourcePath | undefined => {
  const parts = fsPath.split(sep);
  const typeIndex = parts.lastIndexOf(typeDir);
  if (typeIndex < 1) {
    return undefined;
  }
  const inDataspace = parts[typeIndex - 2] === DATASPACE_FOLDER && parts[typeIndex - 3] === D360_ROOT;
  const rootIndex = inDataspace ? typeIndex - 3 : typeIndex - 1;
  return parts[rootIndex] === D360_ROOT ? parts.slice(rootIndex).join(sep) : undefined;
};

/** Joins the dataspace and the component name in a dataspace-scoped fullName: `<dataspace>.<name>`. */
const DATASPACE_NAME_SEPARATOR = '.';

/** The fullName of a component in a dataspace: `<dataspace>.<name>`. */
export const toDataspaceQualifiedName = (dataspace: string, name: string): string =>
  `${dataspace}${DATASPACE_NAME_SEPARATOR}${name}`;

/** Split `<dataspace>.<name>` into its parts, or return undefined when the name has no dataspace. */
export const parseDataspaceQualifiedName = (fullName: string): { dataspace: string; name: string } | undefined => {
  const index = fullName.indexOf(DATASPACE_NAME_SEPARATOR);
  return index > 0 && index < fullName.length - 1
    ? { dataspace: fullName.slice(0, index), name: fullName.slice(index + 1) }
    : undefined;
};

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
export class D360SourceAdapter extends MixedContentSourceAdapter {
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
    // The package path of a Data Cloud component is its path from the `d360` folder down. Without that
    // folder the component has no package path, so it is rejected instead of being sent or written wrongly.
    const { directoryName, name: typeName } = this.type;
    if (!getD360RelativePath(contentPath, directoryName)) {
      throw new SfError(
        messages.getMessage('error_d360_outside_root', [contentPath, typeName, directoryName, directoryName]),
        'ExpectedSourceFilesError'
      );
    }

    const name = this.calculateD360Name(contentPath);
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
   * `.../d360/dataspace/<dataspace>/<typeDir>/<name>.json`. Types that aren't dataspace-scoped
   * sit directly under `d360/<typeDir>/` and keep their bare `<name>`.
   */
  private calculateD360Name(contentPath: SourcePath): string {
    const pathParts = contentPath.split(sep);
    const typeFolderIndex = pathParts.lastIndexOf(this.type.directoryName);
    const isDataspaceScoped = typeFolderIndex > 1 && pathParts[typeFolderIndex - 2] === DATASPACE_FOLDER;
    const shortName = baseName(contentPath);
    return isDataspaceScoped ? toDataspaceQualifiedName(pathParts[typeFolderIndex - 1], shortName) : shortName;
  }
}
