import { MatchingContentFile } from './matchingContentFile';
import { SourceAdapter } from '../types';
import { Simple } from './simple';
import { InFolders } from './inFolders';
import { Bundle } from './bundle';

type AdapterIndex = {
  [adapterId: string]: SourceAdapter;
};

export const adapterIndex: AdapterIndex = {
  bundle: new Bundle(),
  inFolders: new InFolders(),
  matchingContentFile: new MatchingContentFile(),
  simple: new Simple()
};
