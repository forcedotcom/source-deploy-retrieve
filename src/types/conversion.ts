import { MetadataComponent, SourcePath } from './common';

export type ConversionType = 'toApi' | 'toSource';

export type ConversionResult = {
  components: MetadataComponent[];
  type: ConversionType;
  /**
   * Path to the generated package xml manifest
   */
  manifest?: SourcePath;
};

export type ConvertSourceOptions = {
  /**
   * Whether or not the package should be zipped.
   */
  zip: boolean;
  /**
   * Path to the created package. Optional if the zip option is true to store in memory,
   * otherwise an error will be thrown.
   */
  output?: SourcePath;
};
