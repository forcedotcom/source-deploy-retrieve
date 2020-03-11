import {
  SourceAdapter,
  MetadataType,
  SourcePath,
  MetadataComponent
} from '../types';
import { RegistryAccess } from '../registry';
import { sep, join, dirname } from 'path';
import { readdirSync, lstatSync } from 'fs';
import { parseMetadataXml, walk } from '../util';
import { META_XML_SUFFIX } from '../constants';
import { BaseSourceAdapter } from './base';

export class Bundle extends BaseSourceAdapter {
  protected getSourcePaths(
    fsPath: SourcePath,
    isMetaXml: boolean
  ): SourcePath[] {
    const bundleRootPath = this.getBundleRootPath(fsPath);
    const ignore = isMetaXml ? fsPath : this.getMetadataXmlPath(fsPath);
    return walk(bundleRootPath, new Set([ignore]));
  }

  protected getMetadataXmlPath(pathToSource: SourcePath): SourcePath {
    const bundleRootPath = this.getBundleRootPath(pathToSource);
    const xmlFileName = readdirSync(bundleRootPath).find(
      f => !!parseMetadataXml(join(bundleRootPath, f))
    );
    if (xmlFileName) {
      return join(bundleRootPath, xmlFileName);
    }
  }

  private getBundleRootPath(fsPath: SourcePath): SourcePath {
    const pathParts = fsPath.split(sep);
    const bundleIndex =
      pathParts.findIndex(part => part === this.type.directoryName) + 1;
    return pathParts.slice(0, bundleIndex + 1).join(sep);
  }
}
