import {
  SourceAdapter,
  MetadataType,
  SourcePath,
  MetadataComponent
} from '../types';
import { RegistryAccess } from '../registry';
import { sep, join, dirname } from 'path';
import { readdirSync, lstatSync } from 'fs';
import { parseMetadataXml } from '../util';
import { META_XML_SUFFIX } from '../constants';

export class Bundle implements SourceAdapter {
  public getComponent(
    type: MetadataType,
    fsPath: SourcePath
  ): MetadataComponent {
    const dir = dirname(fsPath);
    const pathParts = fsPath.split(sep);
    const fullName =
      pathParts[pathParts.findIndex(part => part === type.directoryName) + 1];

    let metaXml: string;
    if (parseMetadataXml(fsPath)) {
      metaXml = fsPath;
    } else {
      const name = readdirSync(dir).find(f => !!parseMetadataXml(join(dir, f)));
      metaXml = join(dir, name);
    }
    return {
      fullName,
      type,
      metaXml,
      sources: this.walk(dir)
    };
  }

  private walk(dir: SourcePath): SourcePath[] {
    const paths: SourcePath[] = [];
    for (const file of readdirSync(dir)) {
      const path = join(dir, file);
      if (lstatSync(path).isDirectory()) {
        paths.concat(...this.walk(path));
      } else if (!file.endsWith(META_XML_SUFFIX)) {
        paths.push(path);
      }
    }
    return paths;
  }
}
