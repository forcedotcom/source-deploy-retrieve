// determine missing types from metadataCoverageReport
import * as shelljs from 'shelljs';
import { MetadataRegistry } from '../../src';
import { exit } from 'process';
import { fs } from '@salesforce/core';
import * as deepmerge from 'deepmerge';
import { CoverageObject, CoverageObjectType } from '../../src/registry/types';
import { AnyJson } from '@salesforce/ts-types';
import { getMissingTypes } from '../../test/utils/getMissingTypes';
import { getCurrentApiVersion, getCoverage } from './shared';

export const registry = fs.readJsonSync('./src/registry/metadataRegistry.json') as unknown as MetadataRegistry;
export let metadataCoverage: CoverageObject;

interface DescribeResult {
  directoryName: string;
  inFolder: boolean;
  metaFile: boolean;
  suffix: string;
  xmlName: string;
  folderContentType: string;
  childXmlNames: string[];
}

// get the coverage report
(async () => {
  const currentApiVersion = await getCurrentApiVersion();
  const metadataCoverage = await getCoverage(currentApiVersion);
  console.log(
    `CoverageReport shows ${Object.keys(metadataCoverage.types).length} items in the metadata coverage report`
  );
  const missingTypes = getMissingTypes(metadataCoverage, registry);
  if (missingTypes.length === 0) {
    console.log(`Your registry is complete!  Congratulations!`);
    exit(0);
  }
  console.log(
    `There are ${missingTypes.length} items missing from your registry: ${missingTypes
      .map(([typeName]) => typeName)
      .join('\n')}`
  );

  // create an org we can describe
  shelljs.exec('sfdx force:project:create -n registryBuilder', { silent: true });
  updateProjectScratchDef(missingTypes);
  // TODO: sourceApi has to match the coverage report
  if (!process.env.RB_EXISTING_ORG) {
    shelljs.exec('sfdx force:org:create -f registryBuilder/config/project-scratch-def.json -d 1 -a registryBuilder');
  }
  // describe the org
  const missingTypesAsDescribeResult = getMissingTypesAsDescribeResult(missingTypes);
  console.log(missingTypesAsDescribeResult);
  registryUpdate(missingTypesAsDescribeResult);
  // update the registry

  // destroy the scratch org and the project
  if (!process.env.RB_EXISTING_ORG) {
    shelljs.exec('sfdx force:org:delete -u registryBuilder --noprompt');
  }
  shelljs.rm('-rf', 'registryBuilder');
})();

/**
 * Simple type implementation.  Not handling children.
 */
const registryUpdate = (missingTypesAsDescribeResult: DescribeResult[]) => {
  missingTypesAsDescribeResult.map((missingTypeDescribe) => {
    if (missingTypeDescribe.childXmlNames || missingTypeDescribe.folderContentType) {
      console.log(`Skipping ${missingTypeDescribe.xmlName} because it is a folder or has children`);
      return;
    }
    const { xmlName: name, suffix, metaFile, directoryName, inFolder } = missingTypeDescribe;
    let typeId = missingTypeDescribe.xmlName.toLowerCase();

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
    registry.suffixes[suffix] = typeId;
  });
  fs.writeJsonSync('./src/registry/metadataRegistry.json', registry as unknown as AnyJson);
};

const getMissingTypesAsDescribeResult = (missingTypes: [string, CoverageObjectType][]): DescribeResult[] => {
  const describeResult = shelljs.exec('sfdx force:mdapi:describemetadata -u registryBuilder --json', { silent: true });
  const metadataObjectsByName = new Map<string, DescribeResult>();
  (JSON.parse(describeResult.stdout).result.metadataObjects as DescribeResult[]).map((describeObj) => {
    metadataObjectsByName.set(describeObj.xmlName, describeObj);
  });
  // get the missingTypes from the describe
  return missingTypes.map(([key]) => metadataObjectsByName.get(key)).filter(Boolean);
};

const updateProjectScratchDef = (missingTypes: [string, CoverageObjectType][]) => {
  const scratchDefSummary = deepmerge.all(
    [{}].concat(missingTypes.map(([key, missingType]) => missingType.orgShapes.developer))
  ) as {
    features: string[];
  };

  scratchDefSummary.features = [...new Set(scratchDefSummary.features)];
  fs.writeJsonSync('./registryBuilder/config/project-scratch-def.json', { edition: 'developer', ...scratchDefSummary });
  console.log(`Creating org with features ${scratchDefSummary.features.join(',')}`);
};
