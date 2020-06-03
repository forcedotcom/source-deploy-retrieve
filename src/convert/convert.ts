/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  MetadataComponent,
  SfdxFileFormat,
  ConvertOutputConfig,
  SourcePath,
  ConvertResult
} from '../types';
import { ManifestGenerator, RegistryAccess } from '../metadata-registry';
import { promises } from 'fs';
import { join } from 'path';
import { ensureFileExists, ensureDirectoryExists } from '../utils/fileSystemHandler';
import { Writable } from 'stream';
import {
  ComponentReader,
  ComponentConverter,
  StandardWriter,
  pipeline,
  ZipWriter
} from './streams';
import { PACKAGE_XML_FILE, DEFAULT_PACKAGE_PREFIX } from '../utils/constants';
import { ConversionError } from '../errors';

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
    components: MetadataComponent[],
    targetFormat: SfdxFileFormat,
    output: ConvertOutputConfig
  ): Promise<ConvertResult> {
    try {
      // TODO: evaluate if a builder pattern for manifest creation is more efficient here
      const manifestGenerator = new ManifestGenerator(this.registryAccess);
      const manifestContents = manifestGenerator.createManifest(components);
      const packagePath = this.getPackagePath(output);
      const tasks = [];

      // initialize writer
      let writer: Writable;
      switch (output.type) {
        case 'directory':
          writer = new StandardWriter(packagePath);
          const manifestPath = join(packagePath, PACKAGE_XML_FILE);
          ensureDirectoryExists(packagePath);
          tasks.push(promises.writeFile(manifestPath, manifestContents));
          break;
        case 'zip':
          writer = new ZipWriter(packagePath);
          (writer as ZipWriter).addToZip(manifestContents, PACKAGE_XML_FILE);
          break;
      }

      const conversionPipeline = pipeline(
        new ComponentReader(components),
        new ComponentConverter(targetFormat),
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

  private getPackagePath(outputConfig: ConvertOutputConfig): SourcePath | undefined {
    let packagePath: SourcePath;
    const { outputDirectory, packageName } = outputConfig;
    if (outputDirectory) {
      const name = packageName || `${DEFAULT_PACKAGE_PREFIX}_${Date.now()}`;
      packagePath = join(outputDirectory, name);
    }
    return packagePath;
  }
}
