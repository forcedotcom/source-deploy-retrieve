/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { existsSync } from 'fs';
import { sep, parse, basename } from 'path';
import * as data from './data/registry.json';
import { META_XML_SUFFIX } from './constants';
import {
  MetadataComponent,
  MetadataRegistry,
  MetadataType,
  SourcePath
} from './types';
import { nls } from '../i18n';

/**
 * Direct access to the JSON registry data
 */
export const registryData = Object.freeze(data);

/**
 * Primary interface for the metadata registry data. Used to infer information about metadata
 * types and components based on source paths.
 */
export class RegistryAccess {
  private data: MetadataRegistry;

  /**
   * @param customData Optional custom registry data.
   */
  constructor(customData: MetadataRegistry = registryData) {
    this.data = customData;
  }

  /**
   * Get metadata type information.
   *
   * @param name Name of the metadata type
   */
  public getTypeFromName(name: string): MetadataType {
    const lower = name.toLowerCase().replace(/ /g, '');
    if (!this.data.types[lower]) {
      this.error('registry_error_missing_type_definition', lower);
    }
    return this.data.types[lower];
  }

  /**
   * Get the metadata component(s) from a file path.
   *
   * __Current limitations:__
   * - `fsPath` must be a single file - no directories.
   * - Only one component can be returned at a time.
   * - Only types with file suffixes, non-decomposed, single SourcePath
   *
   * @param fsPath File path for a piece of metadata
   */
  public getComponentsFromPath(fsPath: string): MetadataComponent[] {
    if (!existsSync(fsPath)) {
      this.error('registry_error_file_not_found', fsPath);
    }

    const parsedPath = parse(fsPath);
    const sources = new Set<SourcePath>();
    let fullName: string;
    let xmlPath: SourcePath;

    // attempt 1 - try treating the file extension name as a suffix
    let typeId = this.data.suffixes[parsedPath.ext.slice(1)];
    if (typeId) {
      xmlPath = `${fsPath}${META_XML_SUFFIX}`;
      if (!existsSync(xmlPath)) {
        this.error('registry_error_missing_metadata_xml', parsedPath.base);
      }
      sources.add(fsPath);
      fullName = parsedPath.name;
    }
    // attempt 2 - check if it's a metadata xml file
    if (!typeId) {
      const match = parsedPath.base.match(/(.+)\.(.+)-meta\.xml/);
      if (match) {
        const sourcePath = fsPath.slice(0, fsPath.lastIndexOf(META_XML_SUFFIX));
        if (existsSync(sourcePath)) {
          sources.add(sourcePath);
        }
        xmlPath = fsPath;
        fullName = match[1];
        typeId = this.data.suffixes[match[2]];
      }
    }
    // attempt 3 - check if the file is part of a mixed content type
    // if (!typeId) {
    //   const pathPartsSet = new Set(pathParts);
    //   for (const directoryName of Object.keys(registry.mixedContent)) {
    //     if (pathPartsSet.has(directoryName)) {
    //       typeId = registry.mixedContent[directoryName];
    //       // components of a bundle type are assumed to have their direct parent be the type's directoryName
    //       componentName =
    //         pathParts[pathParts.findIndex(part => part === directoryName) + 1];
    //       break;
    //     }
    //   }
    // }

    if (!typeId) {
      this.error('registry_error_unsupported_type');
    } else if (!this.data.types[typeId]) {
      this.error('registry_error_missing_type_definition', typeId);
    }

    const type = this.data.types[typeId] as MetadataType;
    if (type.inFolder) {
      // component names of types with folders have the format folderName/componentName
      fullName = `${basename(parsedPath.dir)}/${fullName}`;
    }

    return [
      {
        fullName,
        type,
        metaXml: xmlPath,
        sources: Array.from(sources)
      }
    ];
  }

  private error(messageKey: string, args?: string[] | string) {
    throw new Error(nls.localize(messageKey, args));
  }
}
