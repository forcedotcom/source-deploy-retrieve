import { SourcePath } from './common';

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
