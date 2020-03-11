import { nls } from '../i18n';
import { SourcePath } from './types';
import { basename, join } from 'path';
import { readdirSync, lstatSync } from 'fs';
import { META_XML_SUFFIX } from './constants';

export const registryError = (messageKey: string, args?: string | string[]) => {
  throw new Error(nls.localize(messageKey, args));
};

export const parseMetadataXml = (fsPath: SourcePath) => {
  const match = basename(fsPath).match(/(.+)\.(.+)-meta\.xml/);
  if (match) {
    return { fullName: match[1], suffix: match[2] };
  }
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
