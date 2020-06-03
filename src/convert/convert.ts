/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { MetadataComponent, SfdxFileFormat, OutputOptions } from '../types';
import { ManifestGenerator, RegistryAccess } from '../metadata-registry';
import { promises } from 'fs';
import { join } from 'path';
import { ensureFileExists } from '../utils/fileSystemHandler';
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

type OutputOptionKeys = keyof OutputOptions;
type OutputConfig<T extends OutputOptionKeys> = { type: T; options: OutputOptions[T] };

export class MetadataConverter {
  private registryAccess: RegistryAccess;

  constructor(registryAccess = new RegistryAccess()) {
    this.registryAccess = registryAccess;
  }

  /**
   * Convert metadata components to another SFDX file format.
   *
   * @param components Components to convert to the target format
   * @param targetFormat Format to convert the component files to
   * @param outputConfig Configuration for outputting the converted files
   */
  public async convert(
    components: MetadataComponent[],
    targetFormat: SfdxFileFormat,
    outputConfig: OutputConfig<OutputOptionKeys>
  ): Promise<void> {
    const tasks = [];
    const { options } = outputConfig;
    const packageName = options.packageName || `${DEFAULT_PACKAGE_PREFIX}_${Date.now()}`;
    const manifestGenerator = new ManifestGenerator(this.registryAccess);

    let writer: Writable;
    try {
      // TODO: evaluate if a builder pattern for manifest creation is more efficient here
      const manifestContents = manifestGenerator.createManifest(components);
      switch (outputConfig.type) {
        case 'directory':
          const manifestPath = join(options.outputDirectory, packageName, PACKAGE_XML_FILE);
          ensureFileExists(manifestPath);
          tasks.push(promises.writeFile(manifestPath, manifestContents));
          writer = new StandardWriter(options.outputDirectory, packageName);
          break;
        case 'zip':
          writer = new ZipWriter(options.outputDirectory, packageName);
          (writer as ZipWriter).zip.append(manifestContents, { name: PACKAGE_XML_FILE });
          break;
      }
      tasks.push(
        pipeline(new ComponentReader(components), new ComponentConverter(targetFormat), writer)
      );

      await Promise.all(tasks);
    } catch (e) {
      throw new ConversionError(e);
    }
  }
}
