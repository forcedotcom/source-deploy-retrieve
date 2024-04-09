/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Readable } from 'node:stream';
import { FileResponseSuccess } from '../client/types';
import { SourcePath } from '../common/types';
import { MetadataComponent, SourceComponent } from '../resolve';

// --------------
// INTERNAL
// --------------

export type WriteInfo =
  | {
      output: SourcePath;
    } & (
      | { source: Readable; shouldDelete?: never }
      // if we delete them, we preserve the info because it'll be hard to reconstruct without the component
      | { source?: never; shouldDelete: true; type: string; fullName: string }
    );

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

type UniqueOutputDir = {
  /**
   * Whether to generate a unique directory within the outputDirectory. Default is true.
   */
  genUniqueDir?: boolean;
};

export type DirectoryConfig = PackageName &
  UniqueOutputDir & {
    type: 'directory';
    /**
     * Directory path to output the converted package to.
     */
    outputDirectory: SourcePath;
  };

export type ZipConfig = PackageName &
  UniqueOutputDir & {
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
  forceIgnoredPaths?: Set<string>;
};

/**
 * Transforms metadata component files into different SFDX file formats
 */
export type MetadataTransformer = {
  defaultDirectory?: string;
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
 * `source` - Friendly for local editing and committing files to source control.
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
   * Converted source components. Not set if archiving the package.
   */
  converted?: SourceComponent[];
  /**
   * Components that were deleted (ex: decomposed children no longer present in the composed parent)
   */
  deleted?: FileResponseSuccess[];
};

/** Stored by file on SourceComponent for stream processing */
export type MarkedReplacement = {
  toReplace: RegExp;
  replaceWith: string;
  matchedFilename: string;
  singleFile?: boolean;
};

// TODO: what's the right way to get this into core/sfdxProjectJson
export type ReplacementConfig = ReplacementLocation &
  ReplacementSource &
  ReplacementTarget & {
    /** Only do the replacement if ALL of the environment values in this array match */
    replaceWhenEnv?: [
      {
        env: string;
        value: string | number | boolean;
      }
    ];
  };

type ReplacementLocation = { filename: string; glob?: never } | { filename?: never; glob: string };
type ReplacementSource =
  | { replaceWithEnv: string; replaceWithFile?: never; allowUnsetEnvVariable?: boolean }
  | { replaceWithEnv?: never; replaceWithFile: string };

type ReplacementTarget =
  | { stringToReplace: string; regexToReplace?: never }
  | {
      stringToReplace?: never;
      /** When putting regex into json, you have to use an extra backslash to escape your regex backslashes because JSON also treats backslash as an escape character */
      regexToReplace: string;
    };

export type ReplacementEvent = {
  filename: string;
  replaced: string;
};
