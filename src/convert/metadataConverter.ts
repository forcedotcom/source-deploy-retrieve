/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { dirname, join, normalize } from 'path';
import { Messages, SfError } from '@salesforce/core';
import { promises } from 'graceful-fs';
import { SourceComponent } from '../resolve';
import { ensureDirectoryExists } from '../utils/fileSystemHandler';
import { SourcePath } from '../common';
import { ComponentSet, DestructiveChangesType } from '../collections';
import { RegistryAccess } from '../registry';
import { ComponentConverter, ComponentReader, pipeline, StandardWriter, ZipWriter } from './streams';
import { ConvertOutputConfig, ConvertResult, DirectoryConfig, SfdxFileFormat, ZipConfig } from './types';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.load('@salesforce/source-deploy-retrieve', 'sdr', [
  'error_failed_convert',
  'error_merge_metadata_target_unsupported',
]);

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

      const isSource = targetFormat === 'source';
      const tasks: Array<Promise<void>> = [];

      let writer: StandardWriter | ZipWriter;
      let mergeSet: ComponentSet;
      let packagePath: SourcePath;
      let defaultDirectory: SourcePath;

      switch (output.type) {
        case 'directory':
          if (output.packageName) {
            cs.fullName = output.packageName;
          }
          packagePath = this.getPackagePath(output);
          defaultDirectory = packagePath;
          writer = new StandardWriter(packagePath);
          if (!isSource) {
            const manifestPath = join(packagePath, MetadataConverter.PACKAGE_XML_FILE);
            tasks.push(
              promises.writeFile(manifestPath, await cs.getPackageXml()),
              ...cs.getTypesOfDestructiveChanges().map(async (destructiveChangesType) =>
                // for each of the destructive changes in the component set, convert and write the correct metadata
                // to each manifest
                promises.writeFile(
                  join(packagePath, this.getDestructiveManifest(destructiveChangesType)),
                  await cs.getPackageXml(4, destructiveChangesType)
                )
              )
            );
          }
          break;
        case 'zip':
          if (output.packageName) {
            cs.fullName = output.packageName;
          }
          packagePath = this.getPackagePath(output);
          defaultDirectory = packagePath;
          writer = new ZipWriter(packagePath);
          if (!isSource) {
            writer.addToZip(await cs.getPackageXml(), MetadataConverter.PACKAGE_XML_FILE);
            // for each of the destructive changes in the component set, convert and write the correct metadata
            // to each manifest
            for (const destructiveChangeType of cs.getTypesOfDestructiveChanges()) {
              writer.addToZip(
                await cs.getPackageXml(4, destructiveChangeType),
                this.getDestructiveManifest(destructiveChangeType)
              );
            }
          }
          break;
        case 'merge':
          if (!isSource) {
            throw new SfError(messages.getMessage('error_merge_metadata_target_unsupported'));
          }
          defaultDirectory = output.defaultDirectory;
          mergeSet = new ComponentSet();
          // since child components are composed in metadata format, we need to merge using the parent
          for (const component of output.mergeWith) {
            mergeSet.add(component.parent ?? component);
          }
          writer = new StandardWriter(output.defaultDirectory);
          writer.forceIgnoredPaths = output.forceIgnoredPaths;
          break;
      }

      const conversionPipeline = pipeline(
        new ComponentReader(components),
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
    } catch (e) {
      throw new SfError(
        messages.getMessage('error_failed_convert', [(e as Error).message]),
        'ConversionError',
        [],
        e as Error
      );
    }
  }

  private getPackagePath(outputConfig: DirectoryConfig | ZipConfig): SourcePath | undefined {
    let packagePath: SourcePath;
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

  private getDestructiveManifest(destructiveChangesType: DestructiveChangesType): string {
    if (destructiveChangesType === DestructiveChangesType.POST) {
      return MetadataConverter.DESTRUCTIVE_CHANGES_POST_XML_FILE;
    } else if (destructiveChangesType === DestructiveChangesType.PRE) {
      return MetadataConverter.DESTRUCTIVE_CHANGES_PRE_XML_FILE;
    }
  }
}
