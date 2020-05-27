import { SourcePath } from './common';

/**
 * The file format for a set of metadata components.
 *
 * `metadata` - Structure for use with the metadata api.
 *
 * `source` - Friendly for local editing and comitting files to source control.
 */
export type SfdxFileFormat = 'metadata' | 'source';

type PackageName = {
  /**
   * Optional name to give to the package output, otherwise one is generated.
   */
  packageName?: string;
};
type DirectoryOptions = PackageName & {
  /**
   * Directory path to output the converted package to.
   */
  outputDirectory: SourcePath;
};
// type ZipOptions = PackageName & { outputDirectory?: SourcePath; compressionLevel?: number };
// type MergeOptions = { defaultDirectory: SourcePath; merge?: MetadataComponent[] };

export type OutputOptions = {
  directory: DirectoryOptions;
  // merge: MergeOptions;
  // zip: ZipOptions | undefined;
};
