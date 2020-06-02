import { SourcePath, MetadataComponent } from './common';
import { Readable } from 'stream';

export type WriteInfo = { relativeDestination: SourcePath; source: Readable };
export type WriterFormat = { component: MetadataComponent; writeInfos: WriteInfo[] };

/**
 * Transforms metadata component files into different SFDX file formats
 */
export interface MetadataTransformer {
  toMetadataFormat(): WriterFormat;
  toSourceFormat(): WriterFormat;
}

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

type DirectoryOutputOptions = PackageName & {
  /**
   * Directory path to output the converted package to.
   */
  outputDirectory: SourcePath;
};
type ZipOptions = PackageName & {
  outputDirectory?: SourcePath;
};
// type MergeOptions = { defaultDirectory: SourcePath; merge?: MetadataComponent[] };

export type OutputOptions = {
  directory: DirectoryOutputOptions;
  zip: ZipOptions | undefined;
  // merge: MergeOptions;
};
