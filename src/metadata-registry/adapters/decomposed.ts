import { MixedContent } from './mixedContent';
import { SourcePath, MetadataComponent } from '../../types';
import { findMetadataXml, parseMetadataXml } from '../../utils/registry';
import { basename, join, dirname } from 'path';
import { readdirSync } from 'fs';
import { isDirectory } from '../../utils/fileSystemHandler';
import { baseName } from '../../utils';

export class Decomposed extends MixedContent {
  protected getMetadataXmlPath(pathToSource: SourcePath): SourcePath {
    // TODO: reuse logic from bundle
    const bundleRootPath = this.getPathToContent(pathToSource);
    return findMetadataXml(bundleRootPath, basename(bundleRootPath));
  }

  protected getSourcePaths(): SourcePath[] | undefined {
    return undefined;
  }

  protected getChildren(xmlPath: SourcePath): MetadataComponent[] | undefined {
    let children: MetadataComponent[];
    if (this.type.children) {
      children = this._getChildren(dirname(xmlPath));
    }
    return children;
  }

  private _getChildren(dirPath: SourcePath): MetadataComponent[] {
    const children: MetadataComponent[] = [];
    for (const fileName of readdirSync(dirPath)) {
      const currentPath = join(dirPath, fileName);
      if (isDirectory(currentPath)) {
        children.push(...this._getChildren(currentPath));
      } else {
        const childXml = parseMetadataXml(fileName);
        if (childXml && childXml.suffix !== this.type.suffix) {
          // TODO: Warn if missing child type definition
          const childTypeId = this.type.children.suffixes[childXml.suffix];
          children.push({
            fullName: baseName(fileName),
            type: this.type.children.types[childTypeId],
            xml: currentPath
          });
        }
      }
    }
    return children;
  }
}
