import { nls } from '../i18n';
import { SourcePath } from './types';
import { basename } from 'path';

export const registryError = (messageKey: string, args?: string | string[]) => {
  throw new Error(nls.localize(messageKey, args));
};

export const parseMetadataXml = (fsPath: SourcePath) => {
  const match = basename(fsPath).match(/(.+)\.(.+)-meta\.xml/);
  if (match) {
    return { fullName: match[1], suffix: match[2] };
  }
};
