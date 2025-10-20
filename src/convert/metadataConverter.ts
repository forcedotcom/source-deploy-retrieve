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
import { Readable, PassThrough } from 'node:stream';
import { dirname, join, normalize } from 'node:path';
import { Messages } from '@salesforce/core/messages';
import { SfError } from '@salesforce/core/sfError';
import { promises, mkdirSync } from 'graceful-fs';
import { isString } from '@salesforce/ts-types';
import { SourceComponent } from '../resolve/sourceComponent';
import { MetadataResolver } from '../resolve/metadataResolver';
import { SourcePath } from '../common/types';
import { ComponentSet } from '../collections/componentSet';
import { DestructiveChangesType } from '../collections/types';
import { RegistryAccess } from '../registry/registryAccess';
import { ComponentConverter, getPipeline, StandardWriter, ZipWriter } from './streams';
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

      const conversionPipeline = getPipeline()(
        Readable.from(components),
        !targetFormatIsSource && (process.env.SF_APPLY_REPLACEMENTS_ON_CONVERT === 'true' || output.type === 'zip')
          ? (await getReplacementMarkingStream(cs.projectDirectory)) ?? new PassThrough({ objectMode: true })
          : new PassThrough({ objectMode: true }),
        new ComponentConverter(targetFormat, this.registry, mergeSet, defaultDirectory),
        writer
      );
      await Promise.all([conversionPipeline, ...tasks]);
      return await getResult(this.registry)(packagePath)(writer);
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

const getResult =
  (registry: RegistryAccess) =>
  (packagePath?: string) =>
  async (writer: StandardWriter | ZipWriter): Promise<ConvertResult> => {
    // union type discrimination
    if ('addToZip' in writer) {
      const buffer = writer.buffer;
      if (!packagePath) {
        return { packagePath, zipBuffer: buffer, zipFileCount: writer.fileCount };
      } else if (buffer) {
        await promises.writeFile(packagePath, buffer);
        return { packagePath };
      }
    } else if (writer.converted?.length > 0 || writer.deleted?.length > 0) {
      const resolver = new MetadataResolver(registry);
      return {
        packagePath,
        converted: writer.converted.flatMap((f) => resolver.getComponentsFromPath(f)),
        deleted: writer.deleted,
      };
    }

    return { packagePath, converted: [], deleted: [] };
  };

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
      mkdirSync(dirname(packagePath), { recursive: true });
    } else {
      mkdirSync(packagePath, { recursive: true });
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
      return getDirectoryConfigOutputs(output, targetFormatIsSource, cs);
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
  for (const component of output.mergeWith) {
    if (component.type.strategies?.adapter === 'digitalExperience' && !component.parent?.content) {
      // DE is addressable without its parent (DEB)
      mergeSet.add(component);
    } else {
      // since child components are composed in metadata format, we need to merge using the parent
      mergeSet.add(component.parent ?? component);
    }
  }
  const writer = new StandardWriter(output.defaultDirectory);

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
  cs: ComponentSet
): Promise<ConfigOutputs> {
  const packagePath = getPackagePath(output);
  return {
    packagePath,
    defaultDirectory: packagePath,
    writer: new StandardWriter(packagePath),
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
