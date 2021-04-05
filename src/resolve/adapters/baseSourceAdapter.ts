/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { SourceAdapter, MetadataXml } from '../types';
import { parseMetadataXml } from '../../utils';
import { UnexpectedForceIgnore } from '../../errors';
import { parentName } from '../../utils/path';
import { ForceIgnore } from '../forceIgnore';
import { dirname, basename, sep } from 'path';
import { NodeFSTreeContainer, TreeContainer } from '../treeContainers';
import { SourceComponent } from '../sourceComponent';
import { SourcePath } from '../../common';
import { MetadataType, RegistryAccess } from '../../registry';

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

  constructor(
    type: MetadataType,
    registry = new RegistryAccess(),
    forceIgnore: ForceIgnore = new ForceIgnore(),
    tree: TreeContainer = new NodeFSTreeContainer()
  ) {
    this.type = type;
    this.registry = registry;
    this.forceIgnore = forceIgnore;
    this.tree = tree;
  }

  public getComponent(path: SourcePath, isResolvingSource = true): SourceComponent {
    let rootMetadata = this.parseAsRootMetadataXml(path);
    if (!rootMetadata) {
      const rootMetadataPath = this.getRootMetadataXmlPath(path);
      if (rootMetadataPath) {
        rootMetadata = parseMetadataXml(rootMetadataPath);
      }
    }
    if (rootMetadata && this.forceIgnore.denies(rootMetadata.path)) {
      throw new UnexpectedForceIgnore('error_no_metadata_xml_ignore', [rootMetadata.path, path]);
    }

    let component: SourceComponent;
    if (rootMetadata) {
      const componentName = this.type.inFolder
        ? `${parentName(rootMetadata.path)}/${rootMetadata.fullName}`
        : rootMetadata.fullName;
      component = new SourceComponent(
        {
          name: componentName,
          type: this.type,
          xml: rootMetadata.path,
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
  private parseAsRootMetadataXml(path: SourcePath): MetadataXml {
    const metaXml = parseMetadataXml(path);
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

    const folderMetadataXml = this.parseAsFolderMetadataXml(path);
    if (folderMetadataXml) {
      return folderMetadataXml;
    }

    if (!this.allowMetadataWithContent()) {
      return this.parseAsContentMetadataXml(path);
    }
  }

  /**
   * If the path given to `getComponent` serves as the sole definition (metadata and content)
   * for a component, parse the name and return it. This allows matching files in metadata
   * format such as:
   *
   *   .../tabs/MyTab.tab
   *
   * @param path File path of a metadata component
   */
  private parseAsContentMetadataXml(path: SourcePath): MetadataXml {
    const parentPath = dirname(path);
    const parts = parentPath.split(sep);
    const typeFolderIndex = parts.lastIndexOf(this.type.directoryName);
    const allowedIndex = this.type.inFolder ? parts.length - 2 : parts.length - 1;

    if (typeFolderIndex !== allowedIndex) {
      return undefined;
    }

    const match = basename(path).match(/(.+)\.(.+)/);
    if (match && this.type.suffix === match[2]) {
      return { fullName: match[1], suffix: match[2], path: path };
    }
  }

  private parseAsFolderMetadataXml(fsPath: SourcePath): MetadataXml {
    const match = basename(fsPath).match(/(.+)-meta\.xml$/);
    const parts = fsPath.split(sep);
    if (match && !match[1].includes('.') && parts.length > 1) {
      return { fullName: match[1], suffix: undefined, path: fsPath };
    }
  }

  /**
   * Determine the related root metadata xml when the path given to `getComponent` isn't one.
   *
   * @param trigger Path that `getComponent` was called with
   */
  protected abstract getRootMetadataXmlPath(trigger: SourcePath): SourcePath;

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
  ): SourceComponent;
}
