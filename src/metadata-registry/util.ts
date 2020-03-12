import { nls } from '../i18n';
import { SourcePath, MetadataXml } from './types';
import { basename, join } from 'path';
import { readdirSync, lstatSync } from 'fs';
import { META_XML_SUFFIX } from './constants';

export const parseMetadataXml = (
  fsPath: SourcePath
): MetadataXml | undefined => {
  const match = basename(fsPath).match(/(.+)\.(.+)-meta\.xml/);
  if (match) {
    return { fullName: match[1], suffix: match[2] };
  }
};

/**
 * Get the file or directory name at the end of a path. This custom verison of
 * path.basename ensures no suffixes at the end.
 * @param fsPath
 */
export const parseBaseName = (fsPath: SourcePath): string => {
  return basename(fsPath).split('.')[0];
};

export const walk = (
  dir: SourcePath,
  ignorePaths?: Set<SourcePath>
): SourcePath[] => {
  const paths: SourcePath[] = [];
  for (const file of readdirSync(dir)) {
    const path = join(dir, file);
    if (lstatSync(path).isDirectory()) {
      paths.push(...walk(path, ignorePaths));
    } else if (!ignorePaths || !ignorePaths.has(path)) {
      paths.push(path);
    }
  }
  return paths;
};
