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
import { ManifestGenerator, RegistryAccess, SourceComponent } from '../metadata-registry';
import { promises } from 'fs';
import { dirname, join } from 'path';
import { ensureDirectoryExists } from '../utils/fileSystemHandler';
import { Writable } from 'stream';
import {
  ComponentReader,
  ComponentConverter,
  StandardWriter,
  pipeline,
  ZipWriter,
} from './streams';
import { PACKAGE_XML_FILE, DEFAULT_PACKAGE_PREFIX } from '../utils/constants';
import { ConversionError, LibraryError } from '../errors';
import { ComponentSet, SourcePath } from '../common';

export class MetadataConverter {
  private registryAccess: RegistryAccess;

  constructor(registryAccess = new RegistryAccess()) {
    this.registryAccess = registryAccess;
  }

  /**
   * Convert metadata components to another SFDX file format.
   *
   * @param components Components to convert
   * @param targetFormat Format to convert the component files to
   * @param output Configuration for outputting the converted files
   */
  public async convert(
    components: SourceComponent[],
    targetFormat: SfdxFileFormat,
    output: ConvertOutputConfig
  ): Promise<ConvertResult> {
    try {
      // TODO: evaluate if a builder pattern for manifest creation is more efficient here
      const manifestGenerator = new ManifestGenerator(this.registryAccess);
      const manifestContents = manifestGenerator.createManifest(components);
      const isSource = targetFormat === 'source';
      const tasks = [];

      let writer: Writable;
      let mergeSet: ComponentSet<SourceComponent>;
      let packagePath: SourcePath;

      switch (output.type) {
        case 'directory':
          packagePath = this.getPackagePath(output);
          writer = new StandardWriter(packagePath);
          if (!isSource) {
            const manifestPath = join(packagePath, PACKAGE_XML_FILE);
            tasks.push(promises.writeFile(manifestPath, manifestContents));
          }
          break;
        case 'zip':
          packagePath = this.getPackagePath(output);
          writer = new ZipWriter(packagePath);
          if (!isSource) {
            (writer as ZipWriter).addToZip(manifestContents, PACKAGE_XML_FILE);
          }
          break;
        case 'merge':
          if (!isSource) {
            throw new LibraryError('error_merge_metadata_target_unsupported');
          }
          mergeSet = new ComponentSet();
          output.mergeWith.forEach((component) => mergeSet.add(component.parent || component));
          writer = new StandardWriter(output.defaultDirectory);
          break;
      }

      const conversionPipeline = pipeline(
        new ComponentReader(components),
        new ComponentConverter(targetFormat, this.registryAccess.registry, undefined, mergeSet),
        writer
      );
      tasks.push(conversionPipeline);
      await Promise.all(tasks);

      const result: ConvertResult = { packagePath };
      if (output.type === 'zip' && !packagePath) {
        result.zipBuffer = (writer as ZipWriter).buffer;
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
      const name = packageName || `${DEFAULT_PACKAGE_PREFIX}_${Date.now()}`;
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
