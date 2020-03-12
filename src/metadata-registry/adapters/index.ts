import { MatchingContentFile } from './matchingContentFile';
import { SourceAdapter, MetadataType } from '../types';
import { Bundle } from './bundle';
import { BaseSourceAdapter } from './base';
import { RegistryAccess } from '../registry';
import { MixedContent } from './anyContent';

type AdapterIndex = {
  [adapterId: string]: SourceAdapter;
};

export const getAdapter = (typeId: string): SourceAdapter => {
  const registry = new RegistryAccess();
  const type = registry.getTypeFromName(typeId);
  const adapter = registry.get().adapters[typeId];
  switch (adapter) {
    case 'bundle':
      return new Bundle(type);
    case 'matchingContentFile':
      return new MatchingContentFile(type);
    case 'mixedContent':
      return new MixedContent(type);
    default:
      return new BaseSourceAdapter(type);
  }
};
