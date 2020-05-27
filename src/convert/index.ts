import { MetadataComponent, SfdxFileFormat, OutputOptions } from '../types';
import { ManifestGenerator } from '../metadata-registry';
import { promises } from 'fs';
import { join } from 'path';
import { ensureDirectoryExists } from '../utils/fileSystemHandler';
import { promisify } from 'util';
import { pipeline as cbPipeline, Writable } from 'stream';
import { ComponentReader, ComponentConverter, StandardWriter } from './streams';
import { PACKAGE_XML_FILE, DEFAULT_PACKAGE_PREFIX } from '../utils/constants';

export const pipeline = promisify(cbPipeline);

type OutputConfig<T extends keyof OutputOptions> = { type: T; options: OutputOptions[T] };

/**
 * Convert metadata components to another SFDX file format.
 *
 * @param components Components to convert to the target format
 * @param targetFormat Format to convert the component files to
 * @param outputConfig Configuration for outputting the converted files
 */
export async function convert<T extends keyof OutputOptions>(
  components: MetadataComponent[],
  targetFormat: SfdxFileFormat,
  outputConfig: OutputConfig<T>
): Promise<void> {
  let writer: Writable;
  const tasks: Promise<void>[] = [];
  const manifestGenerator = new ManifestGenerator();

  if (outputConfig.type === 'directory') {
    const { options } = outputConfig;
    const packageName = options.packageName || `${DEFAULT_PACKAGE_PREFIX}_${Date.now()}`;
    const packagePath = join(options.outputDirectory, packageName);
    ensureDirectoryExists(packagePath);

    // TODO: evaluate if a builder pattern for manifest creation is more efficient here
    const manifestTask = promises.writeFile(
      join(packagePath, PACKAGE_XML_FILE),
      manifestGenerator.createManifest(components)
    );
    tasks.push(manifestTask);
    writer = new StandardWriter(packagePath);
  }

  const conversionPipeline = pipeline(
    new ComponentReader(components),
    new ComponentConverter(targetFormat),
    writer
  );
  tasks.push(conversionPipeline);
  await Promise.all(tasks);
}
