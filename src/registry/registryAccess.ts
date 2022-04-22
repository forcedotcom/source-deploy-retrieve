/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Messages, SfError } from '@salesforce/core';
import { registry as defaultRegistry } from './registry';
import { MetadataRegistry, MetadataType } from './types';

/**
 * Container for querying metadata registry data.
 */

Messages.importMessagesDirectory(__dirname);
const messages = Messages.load('@salesforce/source-deploy-retrieve', 'sdr', [
  'error_missing_child_type_definition',
  'error_missing_type_definition',
]);

export class RegistryAccess {
  private registry: MetadataRegistry;

  private strictFolderTypes: MetadataType[];
  private folderContentTypes: MetadataType[];
  private aliasTypes: MetadataType[];

  public constructor(registry: MetadataRegistry = defaultRegistry) {
    this.registry = registry;
  }

  /**
   * Query a metadata type by its name.
   *
   * @param name - Case-insensitive name of the metadata type
   * @returns The corresponding metadata type object
   */
  public getTypeByName(name: string): MetadataType {
    const lower = name.toLowerCase().trim();
    if (this.registry.childTypes[lower]) {
      const parentTypeId = this.registry.childTypes[lower];
      const childType = this.registry.types[parentTypeId].children?.types[lower];
      if (childType) {
        return childType;
      }
      throw new SfError(
        messages.getMessage('error_missing_child_type_definition', [parentTypeId, lower]),
        'RegistryError'
      );
    }
    if (!this.registry.types[lower]) {
      throw new SfError(messages.getMessage('error_missing_type_definition', [lower]), 'RegistryError');
    }
    // redirect via alias
    return this.registry.types[lower].aliasFor
      ? this.registry.types[this.registry.types[lower].aliasFor]
      : this.registry.types[lower];
  }

  /**
   * Query a metadata type by its file suffix.
   *
   * @param suffix - File suffix of the metadata type
   * @returns The corresponding metadata type object
   */
  public getTypeBySuffix(suffix: string): MetadataType | undefined {
    if (this.registry.suffixes[suffix]) {
      const typeId = this.registry.suffixes[suffix];
      return this.getTypeByName(typeId);
    }
  }

  /**
   * Searches for the first metadata type in the registry that returns `true`
   * for the given predicate function.
   *
   * @param predicate - Predicate to test types with
   * @returns The first metadata type object that fulfills the predicate
   */
  public findType(predicate: (type: MetadataType) => boolean): MetadataType {
    const firstMatch = Object.values(this.registry.types).find(predicate);
    return firstMatch.aliasFor ? this.registry.types[firstMatch.aliasFor] : firstMatch;
  }

  /**
   * Query the types that require a strict parent directory
   *
   * @see {@link MetadataType.strictDirectoryName}
   *
   * @returns An array of metadata type objects that require strict parent folder names
   */
  public getStrictFolderTypes(): MetadataType[] {
    if (!this.strictFolderTypes) {
      this.strictFolderTypes = Object.values(this.registry.strictDirectoryNames).map(
        (typeId) => this.registry.types[typeId]
      );
    }
    return this.strictFolderTypes;
  }

  /**
   * Query for the types that have the folderContentType property defined.
   * E.g., reportFolder, dashboardFolder, documentFolder, emailFolder
   *
   * @see {@link MetadataType.folderContentType}
   *
   * @returns An array of metadata type objects that have folder content
   */
  public getFolderContentTypes(): MetadataType[] {
    if (!this.folderContentTypes) {
      this.folderContentTypes = Object.values(this.registry.types).filter(
        (type) => type.folderContentType && !type.aliasFor
      );
    }
    return this.folderContentTypes;
  }

  /**
   * Query for the types that have the aliasFor property defined.
   * E.g., EmailTemplateFolder
   *
   * @see {@link MetadataType.aliasFor}
   *
   * @returns An array of metadata type objects that have aliasFor
   */
  public getAliasTypes(): MetadataType[] {
    if (!this.aliasTypes) {
      this.aliasTypes = Object.values(this.registry.types).filter((type) => type.aliasFor);
    }
    return this.aliasTypes;
  }
}
