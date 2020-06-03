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

type PackageName = {
  /**
   * Optional name to give to the package, otherwise one is generated.
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
  /**
   * Directory path to output the zip package to.
   */
  outputDirectory?: SourcePath;
};

// type MergeOptions = { defaultDirectory: SourcePath; merge?: MetadataComponent[] };

type ConvertOutputOptions = {
  directory: DirectoryOutputOptions;
  zip: ZipOptions | undefined;
  // merge: MergeOptions;
};

/**
 * The file format for a set of metadata components.
 *
 * `metadata` - Structure for use with the metadata api.
 *
 * `source` - Friendly for local editing and comitting files to source control.
 */
export type SfdxFileFormat = 'metadata' | 'source';

export type ConvertOutputTypes = keyof ConvertOutputOptions;

export type ConvertOutputConfig<T extends ConvertOutputTypes> = {
  type: T;
  options: ConvertOutputOptions[T];
};

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
