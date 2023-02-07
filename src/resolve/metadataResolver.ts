/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { basename, dirname, join, sep } from 'path';
import { Lifecycle, Messages, SfError } from '@salesforce/core';
import { extName, parentName, parseMetadataXml } from '../utils';
import { MetadataType, RegistryAccess } from '../registry';
import { ComponentSet } from '../collections';
import { META_XML_SUFFIX } from '../common';
import { SourceAdapterFactory } from './adapters/sourceAdapterFactory';
import { ForceIgnore } from './forceIgnore';
import { SourceComponent } from './sourceComponent';
import { NodeFSTreeContainer, TreeContainer } from './treeContainers';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.load('@salesforce/source-deploy-retrieve', 'sdr', [
  'error_path_not_found',
  'error_could_not_infer_type',
]);

/**
 * Resolver for metadata type and component objects.
 *
 * @internal
 */
export class MetadataResolver {
  public forceIgnoredPaths: Set<string>;
  private forceIgnore: ForceIgnore;
  private sourceAdapterFactory: SourceAdapterFactory;
  private folderContentTypeDirNames: string[];

  /**
   * @param registry Custom registry data
   * @param tree `TreeContainer` to traverse with
   */
  public constructor(
    private registry = new RegistryAccess(),
    private tree: TreeContainer = new NodeFSTreeContainer(),
    private useFsForceIgnore = true
  ) {
    this.sourceAdapterFactory = new SourceAdapterFactory(this.registry, tree);
    this.forceIgnoredPaths = new Set<string>();
  }

  /**
   * Get the metadata component(s) from a file path.
   *
   * @param fsPath File path to metadata or directory
   * @param inclusiveFilter Set to filter which components are resolved
   */
  public getComponentsFromPath(fsPath: string, inclusiveFilter?: ComponentSet): SourceComponent[] {
    if (!this.tree.exists(fsPath)) {
      throw new SfError(messages.getMessage('error_path_not_found', [fsPath]), 'TypeInferenceError');
    }

    // use the default ignore if we aren't using a real one
    this.forceIgnore = this.useFsForceIgnore ? ForceIgnore.findAndCreate(fsPath) : new ForceIgnore();

    if (this.tree.isDirectory(fsPath) && !this.resolveDirectoryAsComponent(fsPath)) {
      return this.getComponentsFromPathRecursive(fsPath, inclusiveFilter);
    }

    const component = this.resolveComponent(fsPath, true);
    return component ? [component] : [];
  }

  private getComponentsFromPathRecursive(dir: string, inclusiveFilter?: ComponentSet): SourceComponent[] {
    const dirQueue: string[] = [];
    const components: SourceComponent[] = [];
    const ignore = new Set();

    if (this.forceIgnore.denies(dir)) {
      return components;
    }

    for (const file of this.tree.readDirectory(dir)) {
      const fsPath = join(dir, file);

      if (ignore.has(fsPath)) {
        continue;
      }

      if (this.tree.isDirectory(fsPath)) {
        if (this.resolveDirectoryAsComponent(fsPath)) {
          const component = this.resolveComponent(fsPath, true);
          if (component && (!inclusiveFilter || inclusiveFilter.has(component))) {
            components.push(component);
            ignore.add(component.xml);
          }
        } else {
          dirQueue.push(fsPath);
        }
      } else if (this.isMetadata(fsPath)) {
        const component = this.resolveComponent(fsPath, false);
        if (component) {
          if (!inclusiveFilter || inclusiveFilter.has(component)) {
            components.push(component);
            ignore.add(component.content);
          } else {
            for (const child of component.getChildren()) {
              if (inclusiveFilter.has(child)) {
                components.push(child);
              }
            }
          }
          // don't traverse further if not in a root type directory. performance optimization
          // for mixed content types and ensures we don't add duplicates of the component.
          const typeDir = basename(dirname(component.type.inFolder ? dirname(fsPath) : fsPath));
          if (component.type.strictDirectoryName && typeDir !== component.type.directoryName) {
            return components;
          }
        }
      }
    }

    for (const directory of dirQueue) {
      components.push(...this.getComponentsFromPathRecursive(directory, inclusiveFilter));
    }

    return components;
  }

  private resolveComponent(fsPath: string, isResolvingSource: boolean): SourceComponent {
    if (this.forceIgnore.denies(fsPath)) {
      // don't resolve the component if the path is denied
      this.forceIgnoredPaths.add(fsPath);
      return;
    }
    const type = this.resolveType(fsPath);
    if (type) {
      const adapter = this.sourceAdapterFactory.getAdapter(type, this.forceIgnore);
      // short circuit the component resolution unless this is a resolve for a
      // source path or allowed content-only path, otherwise the adapter
      // knows how to handle it
      const shouldResolve =
        parseAsRootMetadataXml(fsPath) ||
        isResolvingSource ||
        !this.parseAsContentMetadataXml(fsPath) ||
        !adapter.allowMetadataWithContent();
      return shouldResolve ? adapter.getComponent(fsPath, isResolvingSource) : undefined;
    }
    void Lifecycle.getInstance().emitTelemetry({
      eventName: 'metadata_resolver_type_inference_error',
      library: 'SDR',
      function: 'resolveComponent',
      path: fsPath,
    });
    throw new SfError(messages.getMessage('error_could_not_infer_type', [fsPath]), 'TypeInferenceError');
  }

  private resolveTypeFromStrictFolder(fsPath: string): MetadataType | undefined {
    const pathParts = fsPath.split(sep);
    // first, filter out types that don't appear in the path
    // then iterate using for/of to allow for early break
    return this.registry
      .getStrictFolderTypes()
      .filter(
        (type) =>
          // the type's directory is in the path, AND
          pathParts.includes(type.directoryName) &&
          // types with folders only have folder components living at the top level.
          // if the fsPath is a folder component, let a future strategy deal with it
          (!type.inFolder || parentName(fsPath) !== type.directoryName)
      )
      .find(
        (type) =>
          // any of the following 3 options is considered a good match
          // mixedContent and bundles don't have a suffix to match
          ['mixedContent', 'bundle'].includes(type.strategies?.adapter) ||
          // the file suffix (in source or mdapi format) matches the type suffix we think it is
          (type.suffix && [type.suffix, `${type.suffix}${META_XML_SUFFIX}`].some((s) => fsPath.endsWith(s))) ||
          // the type has children and the file suffix (in source format) matches a child type suffix of the type we think it is
          (type.children?.types &&
            Object.values(type.children?.types)
              .map((childType) => `${childType.suffix}${META_XML_SUFFIX}`)
              .some((s) => fsPath.endsWith(s)))
      );
  }

  private resolveType(fsPath: string): MetadataType | undefined {
    // attempt 1 - check if the file is part of a component that requires a strict type folder
    let resolvedType = this.resolveTypeFromStrictFolder(fsPath);

    // attempt 2 - check if it's a metadata xml file
    if (!resolvedType) {
      const parsedMetaXml = parseMetadataXml(fsPath);
      if (parsedMetaXml) {
        resolvedType = this.registry.getTypeBySuffix(parsedMetaXml.suffix);
      }
    }

    // attempt 2.5 - test for a folder style xml file
    if (!resolvedType) {
      const metadataFolder = this.parseAsFolderMetadataXml(fsPath);
      if (metadataFolder) {
        // multiple matching directories may exist - folder components are not 'inFolder'
        resolvedType = this.registry.findType((type) => type.directoryName === metadataFolder && !type.inFolder);
      }
    }

    // attempt 3 - try treating the file extension name as a suffix
    if (!resolvedType) {
      resolvedType = this.registry.getTypeBySuffix(extName(fsPath));
    }

    // attempt 4 - try treating the content as metadata
    if (!resolvedType) {
      const metadata = this.parseAsMetadata(fsPath);
      if (metadata) {
        resolvedType = this.registry.getTypeByName(metadata);
      }
    }

    return resolvedType;
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
  private resolveDirectoryAsComponent(dirPath: string): boolean {
    let shouldResolve = true;

    const type = this.resolveType(dirPath);
    if (type) {
      const { directoryName, inFolder } = type;
      const parts = dirPath.split(sep);
      const folderOffset = inFolder ? 2 : 1;
      const typeDirectoryIndex = parts.lastIndexOf(directoryName);
      if (
        typeDirectoryIndex === -1 ||
        parts.length - folderOffset <= typeDirectoryIndex ||
        // ex: /lwc/folder/lwc/cmp
        this.tree.readDirectory(dirPath).includes(type.directoryName) ||
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
  private parseAsContentMetadataXml(fsPath: string): boolean {
    return !!this.registry.getTypeBySuffix(extName(fsPath));
  }

  // Get the array of directoryNames for types that have folderContentType
  private getFolderContentTypeDirNames(): string[] {
    if (!this.folderContentTypeDirNames) {
      this.folderContentTypeDirNames = this.registry.getFolderContentTypes().map((t) => t.directoryName);
    }
    return this.folderContentTypeDirNames;
  }

  /**
   * Identify metadata xml for a folder component:
   * .../email/TestFolder-meta.xml
   * .../reports/foo/bar-meta.xml
   *
   * Do not match this pattern:
   * .../tabs/TestFolder.tab-meta.xml
   */
  private parseAsFolderMetadataXml(fsPath: string): string {
    let folderName: string;
    const match = new RegExp(/(.+)-meta\.xml/).exec(basename(fsPath));
    if (match && !match[1].includes('.')) {
      const parts = fsPath.split(sep);
      if (parts.length > 1) {
        const folderContentTypesDirs = this.getFolderContentTypeDirNames();
        // check if the path contains a folder content name as a directory
        // e.g., `/reports/` and if it does return that folder name.
        folderContentTypesDirs.some((dirName) => {
          if (fsPath.includes(`${sep}${dirName}${sep}`)) {
            folderName = dirName;
          }
        });
      }
    }
    return folderName;
  }

  /**
   * If this file should be considered as a metadata file then return the metadata type
   */
  private parseAsMetadata(fsPath: string): string {
    if (this.tree.isDirectory(fsPath)) {
      return;
    }
    return ['DigitalExperience', 'ExperiencePropertyTypeBundle']
      .map((type) => this.registry.getTypeByName(type))
      .find((type) => fsPath.split(sep).includes(type.directoryName))?.name;
  }

  private isMetadata(fsPath: string): boolean {
    return (
      !!parseMetadataXml(fsPath) ||
      this.parseAsContentMetadataXml(fsPath) ||
      !!this.parseAsFolderMetadataXml(fsPath) ||
      !!this.parseAsMetadata(fsPath)
    );
  }
}

/**
 * Any metadata xml file (-meta.xml) is potentially a root metadata file.
 *
 * @param fsPath File path of a potential metadata xml file
 */
const parseAsRootMetadataXml = (fsPath: string): boolean => Boolean(parseMetadataXml(fsPath));
