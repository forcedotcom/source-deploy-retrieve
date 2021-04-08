/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  SfdxFileFormat,
  ConvertOutputConfig,
  ConvertResult,
  DirectoryConfig,
  ZipConfig,
} from './types';
import { SourceComponent } from '../resolve';
import { promises } from 'fs';
import { dirname, join } from 'path';
import { ensureDirectoryExists } from '../utils/fileSystemHandler';
import {
  ComponentReader,
  ComponentConverter,
  StandardWriter,
  pipeline,
  ZipWriter,
  ComponentWriter,
} from './streams';
import { ConversionError, LibraryError } from '../errors';
import { SourcePath } from '../common';
import { ComponentSet } from '../collections';
import { RegistryAccess } from '../registry';

export class MetadataConverter {
  public static readonly PACKAGE_XML_FILE = 'package.xml';
  public static readonly DEFAULT_PACKAGE_PREFIX = 'metadataPackage';

  private registry: RegistryAccess;

  constructor(registry = new RegistryAccess()) {
    this.registry = registry;
  }

  /**
   * Convert metadata components to another SFDX file format.
   *
   * @param components Components to convert
   * @param targetFormat Format to convert the component files to
   * @param output Configuration for outputting the converted files
   */
  public async convert(
    components: Iterable<SourceComponent>,
    targetFormat: SfdxFileFormat,
    output: ConvertOutputConfig
  ): Promise<ConvertResult> {
    try {
      // it's possible the components came from a component set, so this may be redundant in some cases...
      const cs = new ComponentSet(components, this.registry);
      let manifestContents;
      const isSource = targetFormat === 'source';
      const tasks = [];

      let writer: ComponentWriter;
      let mergeSet: ComponentSet;
      let packagePath: SourcePath;
      let defaultDirectory: SourcePath;

      switch (output.type) {
        case 'directory':
          if (output.packageName) {
            cs.fullName = output.packageName;
          }
          manifestContents = cs.getPackageXml();
          packagePath = this.getPackagePath(output);
          defaultDirectory = packagePath;
          writer = new StandardWriter(packagePath);
          if (!isSource) {
            const manifestPath = join(packagePath, MetadataConverter.PACKAGE_XML_FILE);
            tasks.push(promises.writeFile(manifestPath, manifestContents));
          }
          break;
        case 'zip':
          if (output.packageName) {
            cs.fullName = output.packageName;
          }
          manifestContents = cs.getPackageXml();
          packagePath = this.getPackagePath(output);
          defaultDirectory = packagePath;
          writer = new ZipWriter(packagePath);
          if (!isSource) {
            (writer as ZipWriter).addToZip(manifestContents, MetadataConverter.PACKAGE_XML_FILE);
          }
          break;
        case 'merge':
          if (!isSource) {
            throw new LibraryError('error_merge_metadata_target_unsupported');
          }
          defaultDirectory = output.defaultDirectory;
          mergeSet = new ComponentSet();
          // since child components are composed in metadata format, we need to merge using the parent
          for (const component of output.mergeWith) {
            mergeSet.add(component.parent ?? component);
          }
          writer = new StandardWriter(output.defaultDirectory);
          break;
      }

      const conversionPipeline = pipeline(
        new ComponentReader(components),
        new ComponentConverter(targetFormat, this.registry, mergeSet, defaultDirectory),
        writer
      );
      tasks.push(conversionPipeline);
      await Promise.all(tasks);

      const result: ConvertResult = { packagePath };
      if (output.type === 'zip' && !packagePath) {
        result.zipBuffer = (writer as ZipWriter).buffer;
      } else if (output.type !== 'zip') {
        result.converted = (writer as StandardWriter).converted;
      }
      return result;
    } catch (e) {
      throw new ConversionError(e);
    }
  }

  private getPackagePath(outputConfig: DirectoryConfig | ZipConfig): SourcePath | undefined {
    let packagePath: SourcePath;
    const { outputDirectory, packageName, type } = outputConfig;
    if (outputDirectory) {
      const name = packageName || `${MetadataConverter.DEFAULT_PACKAGE_PREFIX}_${Date.now()}`;
      packagePath = join(outputDirectory, name);

      if (type === 'zip') {
        packagePath += '.zip';
        ensureDirectoryExists(dirname(packagePath));
      } else {
        ensureDirectoryExists(packagePath);
      }
    }
    return packagePath;
  }
}
