/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { registry as defaultRegistry } from './registry';
import { RegistryError } from '../errors';
import { MetadataRegistry, MetadataType } from './types';

/**
 * Container for querying metadata registry data.
 */
export class RegistryAccess {
  private registry: MetadataRegistry;

  constructor(registry: MetadataRegistry = defaultRegistry) {
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
      throw new RegistryError('error_missing_child_type_definition', [parentTypeId, lower]);
    }
    if (!this.registry.types[lower]) {
      throw new RegistryError('error_missing_type_definition', lower);
    }
    return this.registry.types[lower];
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
    return Object.values(this.registry.types).find(predicate);
  }

  /**
   * Query the types that require a strict parent directory
   * @see {@link MetadataType.strictDirectoryName}
   *
   * @returns An array of metadata type objects that require strict parent folder names
   */
  public getStrictFolderTypes(): MetadataType[] {
    return Object.values(this.registry.strictDirectoryNames).map(
      (typeId) => this.registry.types[typeId]
    );
  }

  get apiVersion(): string {
    return this.registry.apiVersion;
  }
}
