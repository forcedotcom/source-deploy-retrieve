/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { existsSync } from 'fs';
import { sep } from 'path';
import * as data from './data/registry.json';
import { META_XML_SUFFIX } from './constants';
import {
  MetadataComponent,
  MetadataRegistry,
  MetadataType,
  SourcePath
} from './types';

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
      throw new Error(`missing metadata type definition for ${lower}`);
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
    const pathParts = fsPath.split(sep);
    const file = pathParts[pathParts.length - 1];
    const extensionIndex = file.indexOf('.');
    const fileName = file.substring(0, extensionIndex);
    const fileExtension = file.substring(extensionIndex + 1);

    if (!existsSync(fsPath)) {
      throw new Error(`file not found ${fsPath}`);
    }

    let typeId: string;
    let fullName = fileName;
    let xmlPath: SourcePath;
    const sources = new Set<SourcePath>();

    // attempt 1 - try treating the file extension as a suffix
    if (this.data.suffixes[fileExtension]) {
      xmlPath = `${fsPath}${META_XML_SUFFIX}`;
      if (!existsSync(xmlPath)) {
        throw new Error(`metadata xml file missing for ${file}`);
      }
      typeId = this.data.suffixes[fileExtension];
      sources.add(fsPath);
    }
    // attempt 2 - check if it's a metadata xml file
    if (!typeId) {
      const match = fileExtension.match(/(.+)-meta\.xml/);
      if (match) {
        const sourcePath = fsPath.slice(0, fsPath.lastIndexOf(META_XML_SUFFIX));
        if (existsSync(sourcePath)) {
          sources.add(sourcePath);
        }
        typeId = this.data.suffixes[match[1]];
        xmlPath = fsPath;
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
      throw new Error(
        'types missing a defined suffix are currently unsupported'
      );
    } else if (!this.data.types[typeId]) {
      throw new Error(`missing metadata type definition for ${typeId}`);
    }

    const type = this.data.types[typeId] as MetadataType;
    if (type.inFolder) {
      // component names of types with folders have the format folderName/componentName
      fullName = `${pathParts[pathParts.length - 2]}/${fileName}`;
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
}
