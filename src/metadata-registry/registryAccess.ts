/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { basename, dirname, join, sep } from 'path';
import { MetadataRegistry, TreeContainer } from './types';
import { TypeInferenceError } from '../errors';
import { extName, parentName } from '../utils/path';
import { deepFreeze, parseMetadataXml } from '../utils/registry';
import { SourceAdapterFactory } from './adapters/sourceAdapterFactory';
import { ForceIgnore } from './forceIgnore';
import { SourceComponent } from './sourceComponent';
import { MetadataType, SourcePath } from '../common';
import { NodeFSTreeContainer } from './treeContainers';
import { registryData } from '.';

/**
 * Resolver for metadata type and component objects.
 */
export class RegistryAccess {
  public readonly registry: MetadataRegistry;
  private forceIgnore: ForceIgnore;
  private sourceAdapterFactory: SourceAdapterFactory;
  private tree: TreeContainer;

  /**
   * @param registry Custom registry data
   * @param tree `TreeContainer` to traverse with
   */
  constructor(registry?: MetadataRegistry, tree: TreeContainer = new NodeFSTreeContainer()) {
    this.registry = registry
      ? // deep freeze a copy, not the original object
        deepFreeze(JSON.parse(JSON.stringify(registry)) as MetadataRegistry)
      : // registryData is already frozen
        registryData;
    this.tree = tree;
    this.sourceAdapterFactory = new SourceAdapterFactory(this.registry, tree);
  }

  /**
   * Get a metadata type definition.
   *
   * @param name Name of the metadata type
   */
  public getTypeFromName(name: string): MetadataType {
    const lower = name.toLowerCase().replace(/ /g, '');
    if (!this.registry.types[lower]) {
      throw new TypeInferenceError('error_missing_type_definition', lower);
    }
    return this.registry.types[lower];
  }

  /**
   * Get the metadata component(s) from a file path.
   *
   * @param fsPath File path for a piece of metadata
   */
  public getComponentsFromPath(fsPath: string): SourceComponent[] {
    if (!this.tree.exists(fsPath)) {
      throw new TypeInferenceError('error_path_not_found', fsPath);
    }

    this.forceIgnore = ForceIgnore.findAndCreate(fsPath);

    if (this.tree.isDirectory(fsPath) && !this.resolveDirectoryAsComponent(fsPath)) {
      return this.getComponentsFromPathRecursive(fsPath);
    }

    const component = this.resolveComponent(fsPath, true);
    return component ? [component] : [];
  }

  public getApiVersion(): string {
    return this.registry.apiVersion;
  }

  private getComponentsFromPathRecursive(dir: SourcePath): SourceComponent[] {
    const dirQueue: SourcePath[] = [];
    const components: SourceComponent[] = [];

    if (this.forceIgnore.denies(dir)) {
      return components;
    }

    for (const file of this.tree.readDirectory(dir)) {
      const fsPath = join(dir, file);
      if (this.tree.isDirectory(fsPath)) {
        if (this.resolveDirectoryAsComponent(fsPath)) {
          components.push(this.resolveComponent(fsPath, true));
        } else {
          dirQueue.push(fsPath);
        }
      } else if (this.isMetadata(fsPath)) {
        const component = this.resolveComponent(fsPath, false);
        if (component) {
          components.push(component);
          // don't traverse further if not in a root type directory. performance optimization
          // for mixed content types and ensures we don't add duplicates of the component.
          const isMixedContent = !!this.registry.strictTypeFolder[component.type.directoryName];
          const typeDir = basename(dirname(component.type.inFolder ? dirname(fsPath) : fsPath));
          if (isMixedContent && typeDir !== component.type.directoryName) {
            return components;
          }
        }
      }
    }

    for (const dir of dirQueue) {
      components.push(...this.getComponentsFromPathRecursive(dir));
    }

    return components;
  }

  private resolveComponent(fsPath: SourcePath, isResolvingSource: boolean): SourceComponent {
    if (this.isMetadata(fsPath) && this.forceIgnore.denies(fsPath)) {
      // don't resolve the component if the metadata xml is denied
      return;
    }
    const type = this.resolveType(fsPath);
    if (type) {
      const adapter = this.sourceAdapterFactory.getAdapter(type, this.forceIgnore);
      // short circuit the component resolution unless this is a resolve for a
      // source path or allowed content-only path, otherwise the adapter
      // knows how to handle it
      const shouldResolve =
        isResolvingSource ||
        !this.parseAsContentMetadataXml(fsPath) ||
        !adapter.allowMetadataWithContent();
      return shouldResolve ? adapter.getComponent(fsPath, isResolvingSource) : undefined;
    }
    throw new TypeInferenceError('error_could_not_infer_type', fsPath);
  }

  private resolveType(fsPath: SourcePath): MetadataType | undefined {
    let typeId: string;

    // attempt 1 - check if the file is part of a component that requires a strict type folder
    const pathParts = new Set(fsPath.split(sep));
    for (const directoryName of Object.keys(this.registry.strictTypeFolder)) {
      if (pathParts.has(directoryName)) {
        typeId = this.registry.strictTypeFolder[directoryName];
        // types with folders only have folder components living at the top level.
        // if the fsPath is a folder component, let a future strategy deal with it
        const isFolderType = this.getTypeFromName(typeId).inFolder;
        if (isFolderType && parentName(fsPath) === directoryName) {
          typeId = undefined;
        }
        break;
      }
    }
    // attempt 2 - check if it's a metadata xml file
    if (!typeId) {
      const parsedMetaXml = parseMetadataXml(fsPath);
      if (parsedMetaXml) {
        typeId = this.registry.suffixes[parsedMetaXml.suffix];
      }
    }
    // attempt 2.5 - test for a folder style xml file
    if (!typeId) {
      const metadataFolder = this.parseAsFolderMetadataXml(fsPath);
      if (metadataFolder) {
        // multiple matching directories may exist - folder components are not 'inFolder'
        typeId = Object.values(this.registry.types).find(
          (d) => d.directoryName === metadataFolder && !d.inFolder
        )?.id;
      }
    }
    // attempt 3 - try treating the file extension name as a suffix
    if (!typeId) {
      typeId = this.registry.suffixes[extName(fsPath)];
    }

    if (typeId) {
      return this.getTypeFromName(typeId);
    }
  }

  /**
   * Whether or not a directory that represents a single component should be resolved as one,
   * or if it should be walked for additional components.
   *
   * If a type can be determined from a directory path, and the end part of the path isn't
   * the directoryName of the type itself, infer the path is part of a mixedContent component
   *
   * @param dirPath Path to a directory
   */
  private resolveDirectoryAsComponent(dirPath: SourcePath): boolean {
    let shouldResolve = true;

    const type = this.resolveType(dirPath);
    if (type) {
      const { directoryName, inFolder } = type;
      const parts = dirPath.split(sep);
      const folderOffset = inFolder ? 2 : 1;
      const typeDirectoryIndex = parts.indexOf(directoryName);
      if (
        typeDirectoryIndex === -1 ||
        parts.length - folderOffset <= typeDirectoryIndex ||
        // types with children may want to resolve them individually
        type.children
      ) {
        shouldResolve = false;
      }
    } else {
      shouldResolve = false;
    }

    return shouldResolve;
  }

  /**
   * Any file with a registered suffix is potentially a content metadata file.
   *
   * @param fsPath File path of a potential content metadata file
   */
  private parseAsContentMetadataXml(fsPath: SourcePath): boolean {
    return this.registry.suffixes.hasOwnProperty(extName(fsPath));
  }

  /**
   * Identify metadata xml for a folder component:
   *    .../email/TestFolder-meta.xml
   *
   * Do not match this pattern:
   *    .../tabs/TestFolder.tab-meta.xml
   */
  private parseAsFolderMetadataXml(fsPath: SourcePath): string {
    const match = basename(fsPath).match(/(.+)-meta\.xml/);
    if (match && !match[1].includes('.')) {
      const parts = fsPath.split(sep);
      return parts.length > 1 ? parts[parts.length - 2] : undefined;
    }
  }

  private isMetadata(fsPath: SourcePath): boolean {
    return (
      !!parseMetadataXml(fsPath) ||
      this.parseAsContentMetadataXml(fsPath) ||
      !!this.parseAsFolderMetadataXml(fsPath)
    );
  }
}
