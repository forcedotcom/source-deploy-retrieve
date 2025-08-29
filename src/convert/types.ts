/*
 * Copyright 2025, Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { Readable } from 'node:stream';
import { JsonMap } from '@salesforce/ts-types';
import { ComponentSet } from '../collections/componentSet';
import { XML_NS_KEY, XML_NS_URL } from '../common/constants';
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

export type ToSourceFormatInput = {
  component: SourceComponent;
  mergeWith?: SourceComponent;
  mergeSet?: ComponentSet;
};
export type ToSourceFormat = (input: ToSourceFormatInput) => Promise<WriteInfo[]>;
/**
 * Transforms metadata component files into different SFDX file formats
 */
export type MetadataTransformer = {
  defaultDirectory?: string;
  toSourceFormat: ToSourceFormat;
  toMetadataFormat(component: SourceComponent): Promise<WriteInfo[]>;
};

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
   * When a zip buffer is created, this is the number of files in the zip.
   */
  zipFileCount?: number;
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
export type XmlObj = { [index: string]: { [XML_NS_KEY]: typeof XML_NS_URL } & JsonMap };
