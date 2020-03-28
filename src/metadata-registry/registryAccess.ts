/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { existsSync, readdirSync, readdir } from 'fs';
import { sep, extname, join, dirname, basename } from 'path';
import {
  MetadataComponent,
  MetadataRegistry,
  MetadataType,
  SourcePath
} from './types';
import { getAdapter, AdapterId } from './adapters';
import { parseMetadataXml, isDirectory, deepFreeze } from './util';
import { TypeInferenceError } from '../errors';
import { registryData } from '.';
import { META_XML_SUFFIX } from './constants';

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
    const components = [];
    if (!existsSync(fsPath)) {
      throw new TypeInferenceError('error_path_not_found', fsPath);
    }

    if (isDirectory(fsPath)) {
      return this.getComponentsFromPathInternal(fsPath);
    } else {
      const component = this.fetchComponent(fsPath);
      if (component) {
        components.push(component);
      }
    }
    return components;
  }

  private getComponentsFromPathInternal(fsPath: string): MetadataComponent[] {
    const dirQueue = [];
    const components = [];
    const types = new Set();

    if (isDirectory(fsPath)) {
      for (const file of readdirSync(fsPath)) {
        const path = join(fsPath, file);
        if (isDirectory(path)) {
          dirQueue.push(path);
        } else if (path.endsWith(META_XML_SUFFIX)) {
          const c = this.fetchComponent(path);
          types.add(c.type.name);
          components.push(c);

          const dir = basename(dirname(path));
          if (!types.has(dir)) {
            return components;
          }
        }
      }
    } else if (fsPath.endsWith(META_XML_SUFFIX)) {
      const c = this.fetchComponent(fsPath);
      types.add(c.type.name);
      components.push(c);

      const dir = basename(dirname(fsPath));
      if (!types.has(dir)) {
        return components;
      }
    }

    for (const dir of dirQueue) {
      components.push(...this.getComponentsFromPathInternal(dir));
    }

    return components;
  }

  private fetchComponent(fsPath: SourcePath): MetadataComponent {
    const typeId = this.determineTypeId(fsPath);
    const adapterId = this.data.adapters[typeId] as AdapterId;
    const adapter = getAdapter(this.getTypeFromName(typeId), adapterId);
    return adapter.getComponent(fsPath);
  }

  private determineTypeId(fsPath: SourcePath): string {
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

    return typeId;
  }
}
