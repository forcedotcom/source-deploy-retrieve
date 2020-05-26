import { SourcePath } from './common';

/**
 * The file format for a set of metadata components.
 *
 * `api` - Structure for use with the metadata api.
 *
 * `source` - Friendly for local editing and comitting files to source control.
 */
export type SfdxFileFormat = 'api' | 'source';

export type ConvertOptions = {
  /**
   * Path to output the converted package to.
   */
  output: SourcePath;
};
