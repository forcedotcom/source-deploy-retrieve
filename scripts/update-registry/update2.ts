// determine missing types from metadataCoverageReport
import got from 'got';
import * as shelljs from 'shelljs';
import { MetadataRegistry } from '../../src';
import { exit } from 'process';
import { fs } from '@salesforce/core';
import * as deepmerge from 'deepmerge';
import { CoverageObjectType, CoverageObject } from '../../src/registry/types';
import { features, hasUnsupportedFeatures } from '../../src/registry/nonSupportedTypes';

const registry = fs.readJsonSync('./src/registry/registry.json') as unknown as MetadataRegistry;
let metadataCoverage: CoverageObject;
let missingTypes: [string, CoverageObjectType][];

interface DescribeResult {
  "directoryName": string,
  "inFolder": boolean,
  "metaFile": boolean,
  "suffix": string,
  "xmlName": string;
}

// get the coverage report
(async () => {
  metadataCoverage = JSON.parse(
        (await got(`https://mdcoverage.secure.force.com/services/apexrest/report`)).body
      ) as CoverageObject;
  console.log(`CoverageReport shows ${Object.keys(metadataCoverage.types).length} items in the metadata coverage report`);

  const missingTypes = getMissingTypes();
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

  shelljs.exec('sfdx force:org:create -f registryBuilder/config/project-scratch-def.json -d 1 -a registryBuilder');
  // describe the org
  const missingTypesAsDescribeResult = getMissingTypesAsDescribeResult();
  console.log(missingTypesAsDescribeResult);
  // update the registry

  // destroy the scratch org and the project
  shelljs.exec('sfdx force:org:delete -u registryBuilder --noprompt');
  shelljs.rm('-rf', 'registryBuilder');
})();

const getMissingTypesAsDescribeResult = (): DescribeResult[] => {
  const describeResult = shelljs.exec('sfdx force:mdapi:describemetadata -u registryBuilder --json', {silent: true});
  const metadataObjectsByName = new Map<string, DescribeResult>();
  (JSON.parse(describeResult.stdout).result.metadataObjects as DescribeResult[]).map(describeObj => {
    metadataObjectsByName.set(describeObj.xmlName, describeObj);
  })
  // get the missingTypes from the describe
  return missingTypes.map(([key]) => metadataObjectsByName.get(key)).filter(Boolean);
}

const getMissingTypes = (): [string, CoverageObjectType][] => {

  const metadataApiTypesFromCoverage = Object.entries(metadataCoverage.types).filter(
        ([key, value]) =>
          value.channels.metadataApi && // if it's not in the mdapi, we don't worry about the registry
          !key.endsWith('Settings') && // individual settings shouldn't be in the registry
          !hasUnsupportedFeatures(value) // we don't support these types
      );
  const registryTypeNames = Object.values(registry.types).flatMap((regType) => [
    regType.name,
    ...(regType.children ? Object.values(regType.children.types).map((child) => child.name) : []),
  ]);
  missingTypes = metadataApiTypesFromCoverage.filter(
    ([key]) => !registryTypeNames.includes(key)
  );
  return missingTypes;
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
}




