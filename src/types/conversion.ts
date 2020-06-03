import { SourcePath, MetadataComponent } from './common';
import { Readable } from 'stream';

// --------------
// INTERNAL
// --------------

type PackageName = {
  /**
   * Optional name to give to the package, otherwise one is generated.
   */
  packageName?: string;
};

type DirectoryConfig = PackageName & {
  type: 'directory';
  /**
   * Directory path to output the converted package to.
   */
  outputDirectory: SourcePath;
};

type ZipConfig = PackageName & {
  type: 'zip';
  /**
   * Directory path to output the zip package to.
   */
  outputDirectory?: SourcePath;
};

export type WriteInfo = { relativeDestination: SourcePath; source: Readable };
export type WriterFormat = { component: MetadataComponent; writeInfos: WriteInfo[] };

/**
 * Transforms metadata component files into different SFDX file formats
 */
export interface MetadataTransformer {
  toMetadataFormat(): WriterFormat;
  toSourceFormat(): WriterFormat;
}

// --------------
// PUBLIC
// --------------

/**
 * The file format for a set of metadata components.
 *
 * `metadata` - Structure for use with the metadata api.
 *
 * `source` - Friendly for local editing and comitting files to source control.
 */
export type SfdxFileFormat = 'metadata' | 'source';

export type ConvertOutputConfig = DirectoryConfig | ZipConfig;

export type ConvertResult = {
  /**
   * Location of converted package. Present if an `outputDirectory` was specified.
   */
  packagePath?: SourcePath;
  /**
   * Buffer of converted package. Present if components were zipped with no `outputDirectory`.
   */
  zipBuffer?: Buffer;
};
