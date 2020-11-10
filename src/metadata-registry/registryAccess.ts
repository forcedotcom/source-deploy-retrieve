/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { registryData } from '.';
import { MetadataType } from '../common';
import { RegistryError } from '../errors';
import { MetadataRegistry } from './types';

/**
 * Accessor for interacting with data that conforms to the MetadataRegistry schema.
 */
export class RegistryAccess {
  private registry: MetadataRegistry;

  constructor(registry: MetadataRegistry = registryData) {
    this.registry = registry;
  }

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

  public getTypeBySuffix(suffix: string): MetadataType | undefined {
    if (this.registry.suffixes[suffix]) {
      const typeId = this.registry.suffixes[suffix];
      return this.getTypeByName(typeId);
    }
  }

  public findType(predicate: (type: MetadataType) => boolean): MetadataType {
    return Object.values(this.registry.types).find(predicate);
  }

  /**
   * Get the types whose component files require having a parent directory named after
   * their assigned directory name.
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
