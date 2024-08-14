import { MetadataRegistry } from '../../../src/registry/types';
import { DescribeEntry } from './types';
import * as fs from 'fs';
import { env } from '@salesforce/kit';
import { getCoverage, getCurrentApiVersion } from 'src/registry/coverage';
import { getMissingTypes } from 'test/utils/getMissingTypes';

export const registry = JSON.parse(
  fs.readFileSync('./src/registry/metadataRegistry.json', 'utf8')
) as unknown as MetadataRegistry;

/**
 * Simple type implementation.  Not handling children.
 */
export const registryUpdate = (missingTypesAsDescribeResult: DescribeEntry[]) => {
  missingTypesAsDescribeResult.map((missingTypeDescribe) => {
    if (missingTypeDescribe.hasChildren || missingTypeDescribe.inFolder) {
      console.log(`Skipping ${missingTypeDescribe.name} because it is a folder or has children`);
      return;
    }
    const { name, suffix, metaFile, directoryName, inFolder } = missingTypeDescribe;
    const typeId = missingTypeDescribe.name.toLowerCase();

    const generatedType = {
      id: typeId,
      name,
      suffix,
      directoryName,
      inFolder,
      strictDirectoryName: false,
    };
    registry.types[typeId] = {
      ...generatedType,
      ...(metaFile ? { strategies: { adapter: 'matchingContentFile' } } : {}),
    };
    if (registry.suffixes) {
      registry.suffixes[suffix] = typeId;
    }
  });
  const jsonData = JSON.stringify(registry, null, 2);
  fs.writeFileSync('./src/registry/metadataRegistry.json', jsonData);
};

export const isDefined = <T>(input: T | undefined): input is T => input !== undefined;

const typesFromCoverageRegistryDelta = async (): Promise<string[]> => {
  const currentApiVersion = env.getNumber('SF_ORG_API_VERSION') ?? (await getCurrentApiVersion());
  console.log(`Using API version: ${currentApiVersion}`);

  const metadataCoverage = await getCoverage(currentApiVersion);
  console.log(
    `CoverageReport shows ${Object.keys(metadataCoverage.types).length} items in the metadata coverage report`
  );
  return getMissingTypes(metadataCoverage, registry).map(([name]) => name);
};

/** if md types were passed in as varArgs, uses those.  Otherwise, gets the missing types by comparing Coverage Report to registry */
export const whatTypesNeedDescribe = async (): Promise<string[]> => {
  const typesToFind = process.argv.length > 2 ? process.argv.slice(2) : await typesFromCoverageRegistryDelta();

  if (typesToFind.length === 0) {
    console.log(`Your registry is complete!  Congratulations!`);
    process.exit(0);
  }
  console.log([`Will get describe for these types:`, ...typesToFind].join('\n - '));

  return typesToFind;
};
