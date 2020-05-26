import { MetadataComponent, ConvertOptions, SfdxFileFormat } from '../types';
import { ManifestGenerator } from '../metadata-registry';
import { promises } from 'fs';
import { join } from 'path';
import { ensureDirectoryExists } from '../utils/fileSystemHandler';
import { promisify } from 'util';
import { pipeline as cbPipeline } from 'stream';
import { ComponentReader, ComponentConverter, StandardWriter } from './streams';
import { PACKAGE_XML_FILE } from '../utils/constants';

export const pipeline = promisify(cbPipeline);

export async function convert(
  components: MetadataComponent[],
  targetFormat: SfdxFileFormat,
  options: ConvertOptions
): Promise<[void, void]> {
  const { output } = options;
  const manifestGenerator = new ManifestGenerator();
  ensureDirectoryExists(output);

  // TODO: evaluate if a builder pattern for manifest creation is more efficient here
  const writeManifest = promises.writeFile(
    join(output, PACKAGE_XML_FILE),
    manifestGenerator.createManifest(components)
  );
  const conversionPipeline = pipeline(
    new ComponentReader(components),
    new ComponentConverter(targetFormat),
    new StandardWriter(output)
  );
  return Promise.all([conversionPipeline, writeManifest]);
}
