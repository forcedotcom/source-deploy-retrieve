/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Readable, PassThrough } from 'node:stream';
import { dirname, join, normalize } from 'node:path';
import { Messages, SfError } from '@salesforce/core';
import { promises } from 'graceful-fs';
import { isString } from '@salesforce/ts-types';
import { MetadataResolver, SourceComponent } from '../resolve';
import { ensureDirectoryExists } from '../utils/fileSystemHandler';
import { SourcePath } from '../common';
import { ComponentSet, DestructiveChangesType } from '../collections';
import { RegistryAccess } from '../registry';
import { ComponentConverter, pipeline, StandardWriter, ZipWriter } from './streams';
import { ConvertOutputConfig, ConvertResult, DirectoryConfig, SfdxFileFormat, ZipConfig, MergeConfig } from './types';
import { getReplacementMarkingStream } from './replacements';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/source-deploy-retrieve', 'sdr');

export class MetadataConverter {
  public static readonly PACKAGE_XML_FILE = 'package.xml';
  public static readonly DESTRUCTIVE_CHANGES_POST_XML_FILE = 'destructiveChangesPost.xml';
  public static readonly DESTRUCTIVE_CHANGES_PRE_XML_FILE = 'destructiveChangesPre.xml';
  public static readonly DEFAULT_PACKAGE_PREFIX = 'metadataPackage';

  private registry: RegistryAccess;

  public constructor(registry = new RegistryAccess()) {
    this.registry = registry;
  }
  // eslint-disable-next-line complexity
  public async convert(
    comps: ComponentSet | Iterable<SourceComponent>,
    targetFormat: SfdxFileFormat,
    output: ConvertOutputConfig
  ): Promise<ConvertResult> {
    try {
      const cs = comps instanceof ComponentSet ? comps : new ComponentSet(comps, this.registry);
      const components = (
        (comps instanceof ComponentSet ? Array.from(comps.getSourceComponents()) : comps) as SourceComponent[]
      ).filter((comp) => comp.type.isAddressable !== false);

      if (output.type !== 'merge' && output.packageName) {
        cs.fullName = output.packageName;
      }
      const targetFormatIsSource = targetFormat === 'source';
      const {
        packagePath,
        defaultDirectory,
        writer,
        mergeSet,
        tasks = [],
      } = await getConvertIngredients(output, cs, targetFormatIsSource, this.registry);

      const conversionPipeline = pipeline(
        Readable.from(components),
        !targetFormatIsSource && (process.env.SF_APPLY_REPLACEMENTS_ON_CONVERT === 'true' || output.type === 'zip')
          ? (await getReplacementMarkingStream(cs.projectDirectory)) ?? new PassThrough({ objectMode: true })
          : new PassThrough({ objectMode: true }),
        new ComponentConverter(targetFormat, this.registry, mergeSet, defaultDirectory),
        writer
      );
      await Promise.all([conversionPipeline, ...tasks]);

      const result: ConvertResult = { packagePath };
      if (output.type === 'zip' && !packagePath) {
        result.zipBuffer = (writer as ZipWriter).buffer;
      } else if (output.type !== 'zip') {
        result.converted = (writer as StandardWriter).converted;
      }
      return result;
    } catch (err) {
      if (!(err instanceof Error) && !isString(err)) {
        throw err;
      }
      // if the error is already somewhat descriptive, use that
      // the allows better error messages to be passed through instead of "failed convert"
      if (err instanceof SfError && (err.name !== 'SfError' || err.actions)) {
        throw err;
      }
      const error = isString(err) ? new Error(err) : err;
      throw new SfError(messages.getMessage('error_failed_convert', [error.message]), 'ConversionError', [], error);
    }
  }
}

function getPackagePath(
  outputConfig: DirectoryConfig | (ZipConfig & Required<Pick<ZipConfig, 'outputDirectory'>>)
): SourcePath;
function getPackagePath(outputConfig: Omit<ZipConfig, 'outputDirectory'>): undefined;
function getPackagePath(outputConfig: DirectoryConfig | ZipConfig): SourcePath | undefined {
  let packagePath: SourcePath | undefined;
  const { genUniqueDir = true, outputDirectory, packageName, type } = outputConfig;
  if (outputDirectory) {
    if (packageName) {
      packagePath = join(outputDirectory, packageName);
    } else if (genUniqueDir) {
      packagePath = join(outputDirectory, `${MetadataConverter.DEFAULT_PACKAGE_PREFIX}_${Date.now()}`);
    } else {
      packagePath = normalize(outputDirectory);
    }

    if (type === 'zip') {
      packagePath += '.zip';
      ensureDirectoryExists(dirname(packagePath));
    } else {
      ensureDirectoryExists(packagePath);
    }
  }
  return packagePath;
}

const getDestructiveManifest = (destructiveChangesType: DestructiveChangesType): string => {
  switch (destructiveChangesType) {
    case DestructiveChangesType.POST:
      return MetadataConverter.DESTRUCTIVE_CHANGES_POST_XML_FILE;
    case DestructiveChangesType.PRE:
      return MetadataConverter.DESTRUCTIVE_CHANGES_PRE_XML_FILE;
  }
};

type ConfigOutputs = {
  writer: StandardWriter | ZipWriter;
  tasks?: Array<Promise<void>>;
  defaultDirectory?: string;
  packagePath?: string;
  mergeSet?: ComponentSet;
  registry?: RegistryAccess;
};

async function getConvertIngredients(
  output: ConvertOutputConfig,
  cs: ComponentSet,
  targetFormatIsSource: boolean,
  registry?: RegistryAccess
): Promise<ConfigOutputs> {
  switch (output.type) {
    case 'directory':
      return getDirectoryConfigOutputs(output, targetFormatIsSource, cs, registry);
    case 'zip':
      return getZipConfigOutputs(output, targetFormatIsSource, cs);
    case 'merge':
      return getMergeConfigOutputs(output, targetFormatIsSource, registry);
  }
}

function getMergeConfigOutputs(
  output: MergeConfig,
  targetFormatIsSource: boolean,
  registry?: RegistryAccess
): ConfigOutputs {
  if (!targetFormatIsSource) {
    throw new SfError(messages.getMessage('error_merge_metadata_target_unsupported'));
  }
  const defaultDirectory = output.defaultDirectory;
  const mergeSet = new ComponentSet(undefined, registry);
  // since child components are composed in metadata format, we need to merge using the parent
  for (const component of output.mergeWith) {
    mergeSet.add(component.parent ?? component);
  }
  const writer = new StandardWriter(output.defaultDirectory);
  if (output.forceIgnoredPaths) {
    writer.forceIgnoredPaths = output.forceIgnoredPaths;
  }
  return {
    writer,
    mergeSet,
    defaultDirectory,
  };
}

async function getZipConfigOutputs(
  output: ZipConfig,
  targetFormatIsSource: boolean,
  cs: ComponentSet
): Promise<ConfigOutputs> {
  const packagePath = getPackagePath(output);
  const writer = new ZipWriter(packagePath);

  if (!targetFormatIsSource) {
    writer.addToZip(await cs.getPackageXml(), MetadataConverter.PACKAGE_XML_FILE);
    // for each of the destructive changes in the component set, convert and write the correct metadata to each manifest
    await Promise.all(
      cs
        .getTypesOfDestructiveChanges()
        .map(async (destructiveChangeType) =>
          writer.addToZip(
            await cs.getPackageXml(4, destructiveChangeType),
            getDestructiveManifest(destructiveChangeType)
          )
        )
    );
  }
  return {
    packagePath,
    defaultDirectory: packagePath,
    writer,
    mergeSet: undefined,
  };
}

async function getDirectoryConfigOutputs(
  output: DirectoryConfig,
  targetFormatIsSource: boolean,
  cs: ComponentSet,
  registry?: RegistryAccess
): Promise<ConfigOutputs> {
  const packagePath = getPackagePath(output);
  return {
    packagePath,
    defaultDirectory: packagePath,
    writer: new StandardWriter(packagePath, new MetadataResolver(registry)),
    tasks: targetFormatIsSource
      ? []
      : [
          promises.writeFile(join(packagePath, MetadataConverter.PACKAGE_XML_FILE), await cs.getPackageXml()),
          ...cs.getTypesOfDestructiveChanges().map(async (destructiveChangesType) =>
            // for each of the destructive changes in the component set, convert and write the correct metadata
            // to each manifest
            promises.writeFile(
              join(packagePath, getDestructiveManifest(destructiveChangesType)),
              await cs.getPackageXml(4, destructiveChangesType)
            )
          ),
        ],
  };
}
