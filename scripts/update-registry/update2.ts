// determine missing types from metadataCoverageReport
import got from 'got';
import * as shelljs from 'shelljs';
import { MetadataRegistry } from '../../src';
import { exit } from 'process';
import { fs } from '@salesforce/core';
import * as deepmerge from 'deepmerge';
import { CoverageObjectType, CoverageObject } from '../../src/registry/types';
import { AnyJson } from '@salesforce/ts-types';
import { getMissingTypes } from '../../test/utils/getMissingTypes';

export const registry = fs.readJsonSync('./src/registry/registry.json') as unknown as MetadataRegistry;
export let metadataCoverage: CoverageObject;
export let missingTypes: [string, CoverageObjectType][];

interface DescribeResult {
  directoryName: string,
  inFolder: boolean,
  metaFile: boolean,
  suffix: string,
  xmlName: string;
  folderContentType: string;
  childXmlNames: string[];
}

// get the coverage report
(async () => {
  metadataCoverage = JSON.parse(
        (await got(`https://mdcoverage.secure.force.com/services/apexrest/report`)).body
      ) as CoverageObject;
  console.log(`CoverageReport shows ${Object.keys(metadataCoverage.types).length} items in the metadata coverage report`);

  const missingTypes = getMissingTypes(metadataCoverage, registry);
  if (missingTypes.length === 0) {
    console.log(
      `Your registry is complete!  Congratulations!`
    );
    exit(0);
  }
  console.log(`There are ${missingTypes.length} items missing from your registry: ${missingTypes.map(([typeName]) => typeName).join('\n')}`);

  // create an org we can describe
  shelljs.exec('sfdx force:project:create -n registryBuilder', {silent: true});
  updateProjectScratchDef();
  // TODO: sourceApi has to match the coverage report
  if (!process.env.RB_EXISTING_ORG) {
    shelljs.exec('sfdx force:org:create -f registryBuilder/config/project-scratch-def.json -d 1 -a registryBuilder');
  }
  // describe the org
  const missingTypesAsDescribeResult = getMissingTypesAsDescribeResult();
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
  missingTypesAsDescribeResult.map(missingTypeDescribe => {
    if (missingTypeDescribe.childXmlNames || missingTypeDescribe.folderContentType) {
      console.log(`Skipping ${missingTypeDescribe.xmlName} because it is a folder or has children`);
      return;
    }
    const { xmlName: name, suffix, directoryName, inFolder } = missingTypeDescribe;
    let typeId = missingTypeDescribe.xmlName.toLowerCase();

    const generatedType = {
      id: typeId,
      name,
      suffix,
      directoryName,
      inFolder,
    };
    registry.types[typeId] = generatedType;
    registry.suffixes[suffix] = typeId;
  })
  fs.writeJsonSync('./src/registry/registry.json', registry as unknown as AnyJson);
}

const getMissingTypesAsDescribeResult = (): DescribeResult[] => {
  const describeResult = shelljs.exec('sfdx force:mdapi:describemetadata -u registryBuilder --json', {silent: true});
  const metadataObjectsByName = new Map<string, DescribeResult>();
  (JSON.parse(describeResult.stdout).result.metadataObjects as DescribeResult[]).map(describeObj => {
    metadataObjectsByName.set(describeObj.xmlName, describeObj);
  })
  // get the missingTypes from the describe
  return missingTypes.map(([key]) => metadataObjectsByName.get(key)).filter(Boolean);
}

const updateProjectScratchDef = () => {
  const scratchDefSummary = deepmerge.all(
        [{}].concat(
          missingTypes.map(([key, missingType]) =>
            JSON.parse(missingType.scratchDefinitions.developer)
          )
        )
      ) as {
        features: string[];
      };

  scratchDefSummary.features = [...new Set(scratchDefSummary.features)];
  fs.writeJsonSync('./registryBuilder/config/project-scratch-def.json', scratchDefSummary)
  console.log(`Creating org with features ${scratchDefSummary.features.join(',')}`);
}




