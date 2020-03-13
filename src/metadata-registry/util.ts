import { nls } from '../i18n';
import { SourcePath, MetadataXml } from './types';
import { basename, join, extname } from 'path';
import { readdirSync, lstatSync } from 'fs';
import { META_XML_SUFFIX } from './constants';

/**
 * Returns the `MetadataXml` info from a given file path. If the path is not a
 * `-meta.xml` file, returns `undefined`
 *
 * @param fsPath
 */
export const parseMetadataXml = (
  fsPath: SourcePath
): MetadataXml | undefined => {
  const match = basename(fsPath).match(/(.+)\.(.+)-meta\.xml/);
  if (match) {
    return { fullName: match[1], suffix: match[2] };
  }
};

export const findMetadataXml = (
  directory: SourcePath,
  fullName: string
): SourcePath | undefined => {
  const fileName = readdirSync(directory).find(
    f => f.startsWith(fullName) && !!parseMetadataXml(join(directory, f))
  );
  if (fileName) {
    return join(directory, fileName);
  }
};

/**
 * Get the file or directory name at the end of a path. This custom verison of
 * path.basename ensures no suffixes at the end.
 *
 * @param fsPath
 */
export const parseBaseName = (fsPath: SourcePath): string => {
  return basename(fsPath).split('.')[0];
};

export const isDirectory = (fsPath: SourcePath): boolean =>
  lstatSync(fsPath).isDirectory();

export const walk = (
  dir: SourcePath,
  ignorePaths?: Set<SourcePath>
): SourcePath[] => {
  const paths: SourcePath[] = [];
  for (const file of readdirSync(dir)) {
    const path = join(dir, file);
    if (isDirectory(path)) {
      paths.push(...walk(path, ignorePaths));
    } else if (!ignorePaths || !ignorePaths.has(path)) {
      paths.push(path);
    }
  }
  return paths;
};
