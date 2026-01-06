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
import { basename, dirname, sep } from 'node:path';
import { Messages } from '@salesforce/core/messages';
import { SfError } from '@salesforce/core/sfError';
import { ensureString } from '@salesforce/ts-types';
import { MetadataXml, SourceAdapter } from '../types';
import { parseMetadataXml, parseNestedFullName } from '../../utils/path';
import { ForceIgnore } from '../forceIgnore';
import { NodeFSTreeContainer, TreeContainer } from '../treeContainers';
import { SourceComponent } from '../sourceComponent';
import { SourcePath } from '../../common/types';
import { MetadataType } from '../../registry/types';
import { RegistryAccess } from '../../registry/registryAccess';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/source-deploy-retrieve', 'sdr');

export abstract class BaseSourceAdapter implements SourceAdapter {
  protected type: MetadataType;
  protected registry: RegistryAccess;
  protected forceIgnore: ForceIgnore;
  protected tree: TreeContainer;

  /**
   * Whether or not an adapter should expect a component to be in its own, self-named
   * folder, including its root metadata xml file.
   */
  protected ownFolder = false;
  protected metadataWithContent = true;

  public constructor(
    type: MetadataType,
    registry = new RegistryAccess(),
    forceIgnore = new ForceIgnore(),
    tree = new NodeFSTreeContainer()
  ) {
    this.type = type;
    this.registry = registry;
    this.forceIgnore = forceIgnore;
    this.tree = tree;
  }

  public getComponent(path: SourcePath, isResolvingSource = true): SourceComponent | undefined {
    let rootMetadata = this.parseAsRootMetadataXml(path);
    if (!rootMetadata) {
      const rootMetadataPath = this.getRootMetadataXmlPath(path);
      if (rootMetadataPath) {
        rootMetadata = this.parseMetadataXml(rootMetadataPath);
      }
    }
    if (rootMetadata && this.forceIgnore.denies(rootMetadata.path)) {
      throw new SfError(
        messages.getMessage('error_no_metadata_xml_ignore', [rootMetadata.path, path]),
        'UnexpectedForceIgnore'
      );
    }

    let component: SourceComponent | undefined;
    if (rootMetadata) {
      const name = calculateName(this.registry)(this.type)(rootMetadata);
      component = new SourceComponent(
        {
          name,
          type: this.type,
          xml: rootMetadata.path,
          parentType: this.type.folderType ? this.registry.getTypeByName(this.type.folderType) : undefined,
        },
        this.tree,
        this.forceIgnore
      );
    }

    return this.populate(path, component, isResolvingSource);
  }

  /**
   * Control whether metadata and content metadata files are allowed for an adapter.
   */
  public allowMetadataWithContent(): boolean {
    return this.metadataWithContent;
  }

  /**
   * If the path given to `getComponent` is the root metadata xml file for a component,
   * parse the name and return it. This is an optimization to not make a child adapter do
   * anymore work to find it.
   *
   * @param path File path of a metadata component
   */
  protected parseAsRootMetadataXml(path: SourcePath): MetadataXml | undefined {
    const metaXml = this.parseMetadataXml(path);
    if (metaXml) {
      let isRootMetadataXml = false;
      if (this.type.strictDirectoryName) {
        const parentPath = dirname(path);
        const typeDirName = basename(this.type.inFolder ? dirname(parentPath) : parentPath);
        const nameMatchesParent = basename(parentPath) === metaXml.fullName;
        const inTypeDir = typeDirName === this.type.directoryName;
        // if the parent folder name matches the fullName OR parent folder name is
        // metadata type's directory name, it's a root metadata xml.
        isRootMetadataXml = nameMatchesParent || inTypeDir;
      } else {
        isRootMetadataXml = true;
      }
      return isRootMetadataXml ? metaXml : undefined;
    }

    const folderMetadataXml = parseAsFolderMetadataXml(path);
    if (folderMetadataXml) {
      return folderMetadataXml;
    }

    if (!this.allowMetadataWithContent()) {
      return parseAsContentMetadataXml(this.type)(path);
    }
  }

  // allowed to preserve API
  // eslint-disable-next-line class-methods-use-this
  protected parseMetadataXml(path: SourcePath): MetadataXml | undefined {
    return parseMetadataXml(path);
  }

  /**
   * Determine the related root metadata xml when the path given to `getComponent` isn't one.
   *
   * @param trigger Path that `getComponent` was called with
   */
  protected abstract getRootMetadataXmlPath(trigger: SourcePath): SourcePath | undefined;

  /**
   * Populate additional properties on a SourceComponent, such as source files and child components.
   * The component passed to `populate` has its fullName, xml, and type properties already set.
   *
   * @param component Component to populate properties on
   * @param trigger Path that `getComponent` was called with
   */
  protected abstract populate(
    trigger: SourcePath,
    component?: SourceComponent,
    isResolvingSource?: boolean
  ): SourceComponent | undefined;
}

/**
 * If the path given to `getComponent` serves as the sole definition (metadata and content)
 * for a component, parse the name and return it. This allows matching files in metadata
 * format such as:
 *
 * .../tabs/MyTab.tab
 *
 * @param path File path of a metadata component
 */
const parseAsContentMetadataXml =
  (type: MetadataType) =>
  (path: SourcePath): MetadataXml | undefined => {
    // InFolder metadata can be nested more than 1 level beneath its
    // associated directoryName.
    if (type.inFolder) {
      const fullName = parseNestedFullName(path, type.directoryName);
      if (fullName && type.suffix) {
        return { fullName, suffix: type.suffix, path };
      }
    }

    const parentPath = dirname(path);
    const parts = parentPath.split(sep);
    const typeFolderIndex = parts.lastIndexOf(type.directoryName);
    // nestedTypes (ex: territory2) have a folderType equal to their type but are themselves
    // in a folder per metadata item, with child folders for rules/territories
    const allowedIndex = type.folderType === type.id ? parts.length - 2 : parts.length - 1;

    if (typeFolderIndex !== allowedIndex) {
      return undefined;
    }

    const match = new RegExp(/(.+)\.(.+)/).exec(basename(path));
    if (match && type.suffix === match[2]) {
      return { fullName: match[1], suffix: match[2], path };
    }
  };

const parseAsFolderMetadataXml = (fsPath: SourcePath): MetadataXml | undefined => {
  const match = new RegExp(/(.+)-meta\.xml$/).exec(basename(fsPath));
  const parts = fsPath.split(sep);
  if (match && !match[1].includes('.') && parts.length > 1) {
    return { fullName: match[1], suffix: undefined, path: fsPath };
  }
};

// Given a MetadataXml, build a fullName from the path and type.
const calculateName =
  (registry: RegistryAccess) =>
  (type: MetadataType) =>
  (rootMetadata: MetadataXml): string => {
    const { directoryName, inFolder, folderType, folderContentType } = type;

    // inFolder types (report, dashboard, emailTemplate, document) and their folder
    // container types (reportFolder, dashboardFolder, emailFolder, documentFolder)
    if (folderContentType ?? inFolder) {
      return ensureString(
        parseNestedFullName(rootMetadata.path, directoryName),
        `Unable to calculate fullName from component at path: ${rootMetadata.path} (${type.name})`
      );
    }

    // not using folders?  then name is fullname
    if (!folderType) {
      return rootMetadata.fullName;
    }
    const grandparentType = registry.getTypeByName(folderType);

    // type is nested inside another type (ex: Territory2Model).  So the names are modelName.ruleName or modelName.territoryName
    if (grandparentType.folderType && grandparentType.folderType !== type.id) {
      const splits = rootMetadata.path.split(sep);
      return `${splits[splits.indexOf(grandparentType.directoryName) + 1]}.${rootMetadata.fullName}`;
    }
    // this is the top level of nested types (ex: in a Territory2Model, the Territory2Model)
    if (grandparentType.folderType === type.id) {
      return rootMetadata.fullName;
    }
    throw messages.createError('cantGetName', [rootMetadata.path, type.name]);
  };
