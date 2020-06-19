/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { sep, join, basename, dirname } from 'path';
import {
  MetadataComponent,
  MetadataRegistry,
  MetadataType,
  SourcePath,
  TreeContainer
} from '../types';
import { parseMetadataXml, deepFreeze } from '../utils/registry';
import { TypeInferenceError } from '../errors';
import { registryData, NodeFSTreeContainer } from '.';
import { MixedContentSourceAdapter } from './adapters/mixedContentSourceAdapter';
import { parentName, extName } from '../utils/path';
import { ForceIgnore } from './forceIgnore';
import { SourceAdapterFactory } from './adapters/sourceAdapterFactory';

/**
 * Infer information about metadata types and components based on source paths.
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
    this.sourceAdapterFactory = new SourceAdapterFactory(this.registry, tree);
    this.tree = tree;
  }

  public getApiVersion(): string {
    return this.registry.apiVersion;
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
  public getComponentsFromPath(fsPath: string): MetadataComponent[] {
    if (!this.tree.exists(fsPath)) {
      throw new TypeInferenceError('error_path_not_found', fsPath);
    }

    let pathForFetch = fsPath;
    this.forceIgnore = ForceIgnore.findAndCreate(fsPath);

    if (this.tree.isDirectory(fsPath)) {
      // If we can determine a type from a directory path, and the end part of the path isn't
      // the directoryName of the type itself, we know the path is part of a mixedContent component
      const type = this.resolveType(fsPath);
      if (type) {
        const { directoryName, inFolder } = type;
        const parts = fsPath.split(sep);
        const folderOffset = inFolder ? 2 : 1;
        if (parts[parts.length - folderOffset] !== directoryName) {
          pathForFetch =
            MixedContentSourceAdapter.findMetadataFromContent(fsPath, type, this.tree) || fsPath;
        }
      }
      if (pathForFetch === fsPath) {
        return this.getComponentsFromPathRecursive(fsPath);
      }
    }

    const component = this.resolveComponent(pathForFetch);
    return component ? [component] : [];
  }

  private getComponentsFromPathRecursive(directory: SourcePath): MetadataComponent[] {
    const dirQueue: SourcePath[] = [];
    const components: MetadataComponent[] = [];

    if (this.forceIgnore.denies(directory)) {
      return components;
    }

    for (const file of this.tree.readDirectory(directory)) {
      const path = join(directory, file);
      if (this.tree.isDirectory(path)) {
        dirQueue.push(path);
      } else if (parseMetadataXml(path)) {
        const component = this.resolveComponent(path);
        if (component) {
          components.push(component);
          // don't traverse further if not in a root type directory. performance optimization
          // for mixed content types and ensures we don't add duplicates of the component.
          const isMixedContent = !!this.registry.mixedContent[component.type.directoryName];
          const typeDir = basename(dirname(component.type.inFolder ? dirname(path) : path));
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

  private resolveComponent(path: SourcePath): MetadataComponent {
    if (parseMetadataXml(path) && this.forceIgnore.denies(path)) {
      // don't bother fetching the component if the meta xml is denied
      return;
    }
    const type = this.resolveType(path);
    if (type) {
      const adapter = this.sourceAdapterFactory.getAdapter(type, this.forceIgnore);
      return adapter.getComponent(path);
    }
    throw new TypeInferenceError('error_could_not_infer_type', path);
  }

  private resolveType(path: SourcePath): MetadataType | undefined {
    let typeId: string;

    // attempt 1 - check if the file is part of a mixed content type
    const pathParts = new Set(path.split(sep));
    for (const directoryName of Object.keys(this.registry.mixedContent)) {
      if (pathParts.has(directoryName)) {
        typeId = this.registry.mixedContent[directoryName];
        // types with folders only have folder components living at the top level.
        // if the fsPath is a folder component, let a future strategy deal with it
        const isFolderType = this.getTypeFromName(typeId).inFolder;
        if (isFolderType && parentName(path) === directoryName) {
          typeId = undefined;
        }
        break;
      }
    }
    // attempt 2 - check if it's a metadata xml file
    if (!typeId) {
      const parsedMetaXml = parseMetadataXml(path);
      if (parsedMetaXml) {
        typeId = this.registry.suffixes[parsedMetaXml.suffix];
      }
    }
    // attempt 3 - try treating the file extension name as a suffix
    if (!typeId) {
      typeId = this.registry.suffixes[extName(path)];
    }

    if (typeId) {
      return this.getTypeFromName(typeId);
    }
  }
}
