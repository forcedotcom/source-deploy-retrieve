/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { MetadataComponent, SourcePath } from '../common/types';
import { Readable } from 'stream';
import { SourceComponent } from '../metadata-registry';
import { ComponentSet } from '../collections';

// --------------
// INTERNAL
// --------------

export type WriteInfo = {
  output: SourcePath;
  source: Readable;
};

export type WriterFormat = {
  component: MetadataComponent;
  writeInfos: WriteInfo[];
};

type PackageName = {
  /**
   * Optional name to give to the package, otherwise one is generated.
   */
  packageName?: string;
};

export type DirectoryConfig = PackageName & {
  type: 'directory';
  /**
   * Directory path to output the converted package to.
   */
  outputDirectory: SourcePath;
};

export type ZipConfig = PackageName & {
  type: 'zip';
  /**
   * Directory path to output the zip package to.
   */
  outputDirectory?: SourcePath;
};

export type MergeConfig = {
  type: 'merge';
  /**
   * Existing components to merge and replace the converted components with.
   */
  mergeWith: Iterable<SourceComponent>;
  /**
   * Location to store components that aren't merged.
   */
  defaultDirectory: SourcePath;
};

/**
 * Transforms metadata component files into different SFDX file formats
 */
export interface MetadataTransformer {
  toMetadataFormat(component: SourceComponent): Promise<WriteInfo[]>;
  toSourceFormat(component: SourceComponent, mergeWith?: SourceComponent): Promise<WriteInfo[]>;
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

export type ConvertOutputConfig = DirectoryConfig | ZipConfig | MergeConfig;

export type ConvertResult = {
  /**
   * Location of converted package. `Undefined` if `outputDirectory` is omitted from output config.
   */
  packagePath?: SourcePath;
  /**
   * Buffer of converted package. `Undefined` if `outputDirectory` is omitted from zip output config.
   */
  zipBuffer?: Buffer;
  /**
   * Converted source components. Not set if archving the package.
   */
  converted?: SourceComponent[];
};
