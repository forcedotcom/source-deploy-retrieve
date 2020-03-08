import {
  SourceAdapter,
  SourcePath,
  MetadataComponent,
  MetadataRegistry,
  MetadataType
} from '../types';
import { registryData, RegistryAccess } from '../registry';
import { parse } from 'path';
import { META_XML_SUFFIX } from '../constants';
import { existsSync } from 'fs';
import { registryError, parseMetadataXml } from '../util';

export class MatchingContentFile implements SourceAdapter {
  public getComponent(
    type: MetadataType,
    fsPath: SourcePath
  ): MetadataComponent {
    const registry = new RegistryAccess();
    const parsedPath = parse(fsPath);
    const parsedXml = parseMetadataXml(fsPath);

    if (parsedXml) {
      const sourcePath = fsPath.slice(0, fsPath.lastIndexOf(META_XML_SUFFIX));
      if (!existsSync(sourcePath)) {
        registryError('registry_error_missing_source_path');
      }
      return {
        fullName: parsedXml.fullName,
        type,
        metaXml: fsPath,
        sources: [sourcePath]
      };
    } else if (registry.get().suffixes[parsedPath.ext.slice(1)]) {
      return {
        fullName: parsedPath.name,
        type,
        metaXml: `${fsPath}${META_XML_SUFFIX}`,
        sources: [fsPath]
      };
    }
  }
}
