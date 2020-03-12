import { MatchingContentFile } from './matchingContentFile';
import { SourceAdapter, MetadataType } from '../types';
import { Bundle } from './bundle';
import { BaseSourceAdapter } from './base';
import { RegistryAccess } from '../registry';
import { MixedContent } from './mixedContent';
import { RegistryError } from '../../errors';

type AdapterIndex = {
  [adapterId: string]: SourceAdapter;
};

export const getAdapter = (typeId: string): SourceAdapter => {
  const registry = new RegistryAccess();
  const type = registry.getTypeFromName(typeId);
  const adapterId = registry.get().adapters[typeId];
  switch (adapterId) {
    case 'bundle':
      return new Bundle(type);
    case 'matchingContentFile':
      return new MatchingContentFile(type);
    case 'mixedContent':
      return new MixedContent(type);
    case undefined:
      return new BaseSourceAdapter(type);
    default:
      throw new RegistryError('error_missing_adapter', [type.name, adapterId]);
  }
};
