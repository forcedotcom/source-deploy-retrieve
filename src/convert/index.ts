import { MetadataComponent, ConvertSourceOptions, ConversionResult } from '../types';
import { ManifestGenerator } from '../metadata-registry';
import { writeFile as cbWriteFile } from 'fs';
import { join } from 'path';
import { ensureDirectoryExists } from '../utils/fileSystemHandler';
import { promisify } from 'util';
import { ComponentConverter } from './componentConverter';
import { DefaultWriter } from './defaultWriter';
import { pipeline as cbPipeline } from 'stream';
import { ComponentReader } from './componentReader';

const pipeline = promisify(cbPipeline);
const writeFile = promisify(cbWriteFile);

export async function convertSource(
  sourceFormat: MetadataComponent[],
  options: ConvertSourceOptions
): Promise<ConversionResult> {
  const { output } = options;
  const manifestGenerator = new ManifestGenerator();
  const manifestPath = join(output, 'package.xml');
  ensureDirectoryExists(output);

  // adopt builder pattern for manifest creation so that we don't have to
  // iterate twice for large collections
  const writeManifest = writeFile(manifestPath, manifestGenerator.createManifest(sourceFormat));
  const conversionPipeline = pipeline(
    new ComponentReader(sourceFormat),
    new ComponentConverter('toApi'),
    new DefaultWriter(output)
  );
  await Promise.all([conversionPipeline, writeManifest]);

  return {
    // TODO: these components should be in the new metadata format
    components: sourceFormat,
    type: 'toApi',
    manifest: manifestPath
  };
}
