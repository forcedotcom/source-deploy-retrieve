/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { SourcePath } from './common';
import { Readable } from 'stream';
import { SourceComponent } from '../metadata-registry';

// --------------
// INTERNAL
// --------------

export type WriteInfo = { relativeDestination: SourcePath; source: Readable };

export type WriterFormat = { component: SourceComponent; writeInfos: WriteInfo[] };

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
   * Location of converted package. `Undefined` if `outputDirectory` is omitted from output config.
   */
  packagePath?: SourcePath;
  /**
   * Buffer of converted package. `Undefined` if `outputDirectory` is omitted from zip output config.
   */
  zipBuffer?: Buffer;
};
