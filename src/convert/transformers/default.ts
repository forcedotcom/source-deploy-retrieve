/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { MetadataComponent, MetadataTransformer, WriterFormat, SourcePath } from '../../types';
import { META_XML_SUFFIX } from '../../utils';
import { createReadStream } from 'fs';
import { sep, join, basename } from 'path';
import { LibraryError } from '../../errors';

/**
 * The default metadata transformer.
 *
 * If a metadata type doesn't have a transformer assigned to it, this one is used
 * during the conversion process. It leaves the component's metadata xml and source
 * files as-is.
 */
export class DefaultTransformer implements MetadataTransformer {
  private component: MetadataComponent;

  constructor(component: MetadataComponent) {
    this.component = component;
  }

  public toMetadataFormat(): WriterFormat {
    const result: WriterFormat = { component: this.component, writeInfos: [] };
    let xmlDest = this.getRelativeDestination(this.component.xml);
    const { sources } = this.component;
    if (sources && sources.length > 0) {
      for (const source of this.component.sources) {
        result.writeInfos.push({
          source: createReadStream(source),
          relativeDestination: this.getRelativeDestination(source)
        });
      }
    } else {
      xmlDest = xmlDest.slice(0, xmlDest.lastIndexOf(META_XML_SUFFIX));
    }
    result.writeInfos.push({
      source: createReadStream(this.component.xml),
      relativeDestination: xmlDest
    });
    return result;
  }

  public toSourceFormat(): WriterFormat {
    throw new LibraryError('error_convert_not_implemented', ['source', this.component.type.name]);
  }

  private getRelativeDestination(fsPath: SourcePath): SourcePath {
    const { directoryName, suffix, inFolder } = this.component.type;
    // if there isn't a suffix, assume this is a mixed content component that must
    // reside in the directoryName of its type. trimUntil maintains the folder structure
    // the file resides in for the new destination.
    if (!suffix) {
      return this.trimUntil(fsPath, directoryName);
    } else if (inFolder) {
      const folderName = this.component.fullName.split('/')[0];
      return join(directoryName, folderName, basename(fsPath));
    }
    return join(directoryName, basename(fsPath));
  }

  private trimUntil(fsPath: string, name: string): string {
    const parts = fsPath.split(sep);
    const index = parts.findIndex(part => name === part);
    return parts.slice(index).join(sep);
  }
}
