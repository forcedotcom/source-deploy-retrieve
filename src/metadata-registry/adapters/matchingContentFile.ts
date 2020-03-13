import {
  SourceAdapter,
  SourcePath,
  MetadataComponent,
  MetadataRegistry,
  MetadataType,
  MetadataXml
} from '../types';
import { registryData, RegistryAccess } from '../registry';
import { parse, extname } from 'path';
import { META_XML_SUFFIX } from '../constants';
import { existsSync } from 'fs';
import { parseMetadataXml } from '../util';
import { BaseSourceAdapter } from './base';
import { ExpectedSourceFilesError } from '../../errors';

/**
 * Handles types with a single content file with a matching file extension.
 * These tend to be the programmatic types.
 *
 * __Example Types__:
 *
 * ApexClass, ApexTrigger, ApexComponent
 *
 * __Example Structure__:
 *
 * ```text
 * foos/
 * ├── foobar.ext
 * ├── foobar.ext-meta.xml
 *```
 */
export class MatchingContentFile extends BaseSourceAdapter {
  protected getMetadataXmlPath(pathToSource: SourcePath): SourcePath {
    return `${pathToSource}${META_XML_SUFFIX}`;
  }

  protected getSourcePaths(fsPath: SourcePath, isMetaXml: boolean) {
    if (isMetaXml) {
      return [fsPath.slice(0, fsPath.lastIndexOf(META_XML_SUFFIX))];
    }
    const registry = new RegistryAccess();
    const suffix = extname(fsPath).slice(1);
    if (registry.get().suffixes[suffix]) {
      return [fsPath];
    }
    throw new ExpectedSourceFilesError(this.type, fsPath);
  }
}
