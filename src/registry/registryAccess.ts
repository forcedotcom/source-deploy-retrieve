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
import { Messages } from '@salesforce/core/messages';
import { SfError } from '@salesforce/core/sfError';
import { MetadataRegistry, MetadataType } from './types';
import { getEffectiveRegistry } from './variants';
import { getSuffixGuesses, getTypeSuggestions } from './levenshtein';

/**
 * Container for querying metadata registry data.
 */

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/source-deploy-retrieve', 'sdr');

export class RegistryAccess {
  private registry: MetadataRegistry;
  private strictFolderTypes?: MetadataType[];
  private folderContentTypes?: MetadataType[];
  private aliasTypes?: MetadataType[];

  public constructor(registry?: MetadataRegistry, projectDir?: string) {
    this.registry = registry ?? getEffectiveRegistry({ projectDir });
  }

  public getRegistry(): MetadataRegistry {
    return this.registry;
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
      throw SfError.create({
        message: messages.getMessage('error_missing_type_definition', [name]),
        name: 'RegistryError',
        actions: getTypeSuggestions(this.registry, lower),
      });
    }
    const alias = this.registry.types[lower].aliasFor;
    // redirect via alias
    return alias ? this.registry.types[alias] : this.registry.types[lower];
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
   * Find similar metadata type matches by its file suffix
   *
   * @param suffix - File suffix of the metadata type
   * @returns An array of similar suffix and metadata type matches
   */
  public guessTypeBySuffix(
    suffix: string
  ): Array<{ suffixGuess: string; metadataTypeGuess: MetadataType }> | undefined {
    const guesses = getSuffixGuesses(Object.keys(this.registry.suffixes), suffix);
    return guesses.length
      ? guesses.map((guess) => ({
          suffixGuess: guess,
          metadataTypeGuess: this.getTypeByName(this.registry.suffixes[guess]),
        }))
      : undefined;
  }

  /**
   * Searches for the first metadata type in the registry that returns `true`
   * for the given predicate function.
   *
   * Can return undefined if no type matches the predicate.
   *
   * @param predicate - Predicate to test types with
   * @returns The first metadata type object that fulfills the predicate
   */
  public findType(predicate: (type: MetadataType) => boolean): MetadataType | undefined {
    const firstMatch = Object.values(this.registry.types).find(predicate);
    return firstMatch?.aliasFor ? this.registry.types[firstMatch.aliasFor] : firstMatch;
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

  /**
   * Return the parent metadata type from the registry for the given child type
   *
   * @param childName - Child metadata type name
   * @returns Parent metadata type object or undefined if no parent exists
   */
  public getParentType(childName: string): MetadataType | undefined {
    const lower = childName.toLowerCase().trim();
    if (this.registry.childTypes[lower]) {
      const parentTypeId = this.registry.childTypes[lower];
      return this.registry.types[parentTypeId];
    }
  }
}
