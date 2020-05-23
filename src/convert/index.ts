import { MetadataComponent, ConvertSourceOptions } from '../types';
import { ManifestGenerator } from '../metadata-registry';
import { writeFile as cbWriteFile } from 'fs';
import { join } from 'path';
import { ensureDirectoryExists } from '../utils/fileSystemHandler';
import { promisify } from 'util';
import { pipeline as cbPipeline } from 'stream';
import { ComponentReader, ComponentConverter, DefaultWriter } from './streams';
import { PACKAGE_XML_FILE } from '../utils/constants';

const writeFile = promisify(cbWriteFile);
export const pipeline = promisify(cbPipeline);

export async function convertSource(
  sourceFormat: MetadataComponent[],
  options: ConvertSourceOptions
): Promise<[void, void]> {
  const { output } = options;
  const manifestGenerator = new ManifestGenerator();
  ensureDirectoryExists(output);

  // TODO: evaluate if a builder pattern for manifest creation is more efficient here
  const writeManifest = writeFile(
    join(output, PACKAGE_XML_FILE),
    manifestGenerator.createManifest(sourceFormat)
  );
  const conversionPipeline = pipeline(
    new ComponentReader(sourceFormat),
    new ComponentConverter('toApi'),
    new DefaultWriter(output)
  );
  return Promise.all([conversionPipeline, writeManifest]);
}
