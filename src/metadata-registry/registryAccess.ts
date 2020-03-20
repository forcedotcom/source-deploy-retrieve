/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { existsSync } from 'fs';
import { sep, extname } from 'path';
import { MetadataComponent, MetadataRegistry, MetadataType } from './types';
import { getAdapter, AdapterId } from './adapters';
import { parseMetadataXml, isDirectory, deepFreeze } from './util';
import { TypeInferenceError } from '../errors';
import { registryData } from '.';

/**
 * Primary interface for the metadata registry data. Used to infer information about metadata
 * types and components based on source paths.
 */
export class RegistryAccess {
  public readonly data: MetadataRegistry;

  /**
   * @param data Optional custom registry data.
   */
  constructor(data?: MetadataRegistry) {
    this.data = data
      ? // deep freeze a copy, not the original object
        deepFreeze(JSON.parse(JSON.stringify(data)) as MetadataRegistry)
      : // registryData is already frozen
        registryData;
  }

  /**
   * Get metadata type information.
   *
   * @param name Name of the metadata type
   */
  public getTypeFromName(name: string): MetadataType {
    const lower = name.toLowerCase().replace(/ /g, '');
    if (!this.data.types[lower]) {
      throw new TypeInferenceError('error_missing_type_definition', lower);
    }
    return this.data.types[lower];
  }

  /**
   * Get the metadata component(s) from a file path.
   *
   * @param fsPath File path for a piece of metadata
   */
  public getComponentsFromPath(fsPath: string): MetadataComponent[] {
    if (!existsSync(fsPath)) {
      throw new TypeInferenceError('error_path_not_found', fsPath);
    } else if (isDirectory(fsPath)) {
      throw new TypeInferenceError('error_directories_not_supported');
    }

    let typeId: string;

    // attempt 1 - check if it's a metadata xml file
    const parsedMetaXml = parseMetadataXml(fsPath);
    if (parsedMetaXml) {
      typeId = this.data.suffixes[parsedMetaXml.suffix];
    }
    // attempt 2 - check if the file is part of a mixed content type
    if (!typeId) {
      const pathParts = new Set(fsPath.split(sep));
      for (const directoryName of Object.keys(this.data.mixedContent)) {
        if (pathParts.has(directoryName)) {
          typeId = this.data.mixedContent[directoryName];
          break;
        }
      }
    }
    // attempt 3 - try treating the file extension name as a suffix
    if (!typeId) {
      // extname include the dot, so we have to remove it to index the suffixes
      const extName = extname(fsPath).split('.')[1];
      typeId = this.data.suffixes[extName];
    }

    if (!typeId) {
      throw new TypeInferenceError('error_could_not_infer_type', fsPath);
    }

    const adapterId = this.data.adapters[typeId] as AdapterId;
    const adapter = getAdapter(this.getTypeFromName(typeId), adapterId);
    return [adapter.getComponent(fsPath)];
  }
}
