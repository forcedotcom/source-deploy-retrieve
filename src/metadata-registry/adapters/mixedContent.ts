import { BaseSourceAdapter } from './base';
import { SourcePath, MetadataXml } from '../types';
import { sep, basename, dirname, join } from 'path';
import { readdirSync, lstatSync } from 'fs';
import { parseMetadataXml, walk, parseBaseName } from '../util';

export class MixedContent extends BaseSourceAdapter {
  protected getMetadataXmlPath(pathToSource: SourcePath): SourcePath {
    const contentPath = this.getPathToContent(pathToSource);
    const contentName = parseBaseName(contentPath);
    const contentPathDir = dirname(contentPath);
    const xmlFileName = readdirSync(contentPathDir).find(
      f =>
        f.startsWith(contentName) && !!parseMetadataXml(join(contentPathDir, f))
    );
    if (xmlFileName) {
      return join(contentPathDir, xmlFileName);
    }
  }

  protected getSourcePaths(
    fsPath: SourcePath,
    isMetaXml: boolean
  ): SourcePath[] {
    let contentPath;
    const ignore = new Set<SourcePath>();
    if (!isMetaXml) {
      contentPath = this.getPathToContent(fsPath);
      ignore.add(this.getMetadataXmlPath(fsPath));
    } else {
      const metadataXml = parseMetadataXml(fsPath);
      const dir = dirname(fsPath);
      const contentFile = readdirSync(dir).find(
        f =>
          f.startsWith(metadataXml.fullName) && !parseMetadataXml(join(dir, f))
      );
      contentPath = join(dir, contentFile);
      ignore.add(fsPath);
    }
    if (lstatSync(contentPath).isDirectory()) {
      return walk(contentPath, ignore);
    }
    return [contentPath];
  }

  protected getPathToContent(fsPath: SourcePath): SourcePath {
    const pathParts = fsPath.split(sep);
    let typeFolderIndex = pathParts.findIndex(
      part => part === this.type.directoryName
    );
    const offset = this.type.inFolder ? 3 : 2;
    return pathParts.slice(0, typeFolderIndex + offset).join(sep);
  }
}
