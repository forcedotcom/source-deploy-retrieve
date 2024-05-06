// determine missing types from metadataCoverageReport
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'fs';
import { MetadataRegistry } from '../../src';
import { exit } from 'process';
import * as deepmerge from 'deepmerge';
import { CoverageObject, CoverageObjectType } from '../../src/registry/types';
import { getMissingTypes } from '../../test/utils/getMissingTypes';
import { getCurrentApiVersion, getCoverage } from '../../src/registry/coverage';
import { env } from '@salesforce/kit';

export let metadataCoverage: CoverageObject;
const execProm = promisify(exec);

interface DescribeResult {
  directoryName: string;
  inFolder: boolean;
  metaFile: boolean;
  suffix: string;
  xmlName: string;
  folderContentType: string;
  childXmlNames: string[];
}

const registry = JSON.parse(
  fs.readFileSync('./src/registry/metadataRegistry.json', 'utf8')
) as unknown as MetadataRegistry;

const updateProjectScratchDef = (missingTypes: [string, CoverageObjectType][]) => {
  const scratchDefSummary = deepmerge.all(
    [{}].concat(missingTypes.map(([key, missingType]) => missingType.orgShapes.developer))
  ) as {
    features: string[];
  };

  scratchDefSummary.features = [...new Set(scratchDefSummary.features)];
  const jsonData = JSON.stringify({ edition: 'developer', ...scratchDefSummary });
  fs.writeFileSync('./registryBuilder/config/project-scratch-def.json', jsonData);
  if (scratchDefSummary.features.length > 0) {
    console.log(`Creating org with features ${scratchDefSummary.features.join(',')}`);
  }
};

const getMissingTypesAsDescribeResult = async (
  missingTypes: [string, CoverageObjectType][]
): Promise<DescribeResult[]> => {
  const describeResult = await execProm('sf org list metadata-types -o registryBuilder --json');
  const metadataObjectsByName = new Map<string, DescribeResult>();
  (JSON.parse(describeResult.stdout).result.metadataObjects as DescribeResult[]).map((describeObj) => {
    metadataObjectsByName.set(describeObj.xmlName, describeObj);
  });
  // get the missingTypes from the describe
  return missingTypes.map(([key]) => metadataObjectsByName.get(key)).filter((t): t is DescribeResult => !!t); // <-- satisfies TS compiler
};

/**
 * Simple type implementation.  Not handling children.
 */
const registryUpdate = (missingTypesAsDescribeResult: DescribeResult[]) => {
  missingTypesAsDescribeResult.map((missingTypeDescribe) => {
    if (missingTypeDescribe.childXmlNames?.length || missingTypeDescribe.folderContentType) {
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
    if (registry.suffixes) {
      registry.suffixes[suffix] = typeId;
    }
  });
  const jsonData = JSON.stringify(registry, null, 2);
  fs.writeFileSync('./src/registry/metadataRegistry.json', jsonData);
};

// get the coverage report
(async () => {
  const currentApiVersion = env.getNumber('SF_ORG_API_VERSION') ?? (await getCurrentApiVersion());
  console.log(`Using API version: ${currentApiVersion}`);

  const metadataCoverage = await getCoverage(currentApiVersion);
  console.log(
    `CoverageReport shows ${Object.keys(metadataCoverage.types).length} items in the metadata coverage report`
  );
  const missingTypes = getMissingTypes(metadataCoverage, registry).filter(([name]) =>
    process.argv.length > 2 ? process.argv.includes(name) : true
  );
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
  await execProm('sf project generate -n registryBuilder');
  updateProjectScratchDef(missingTypes);
  // TODO: sourceApi has to match the coverage report
  if (!process.env.RB_EXISTING_ORG) {
    const hasDefaultDevHub = Boolean(
      JSON.parse((await execProm('sf config get target-dev-hub --json')).stdout).result[0].value
    );

    if (!hasDefaultDevHub) {
      console.log(`
Failed to create scratch org: default Dev Hub not found.
To create the scratch org you need to set a default Dev Hub with \`sfdx\`.
Example: \`sf config set defaultdevhubusername=<devhub-username> --global\`
`);
      exit(1);
    }

    await execProm(
      'sf org create scratch -f registryBuilder/config/project-scratch-def.json -y 1 -a registryBuilder --wait 30'
    );
  }
  // describe the org
  const missingTypesAsDescribeResult = await getMissingTypesAsDescribeResult(missingTypes);
  console.log(missingTypesAsDescribeResult);
  registryUpdate(missingTypesAsDescribeResult);

  // update the registry

  // destroy the scratch org and the project
  if (!process.env.RB_EXISTING_ORG) {
    await execProm('sf org delete scratch -o registryBuilder --no-prompt');
  }
  fs.rmSync('registryBuilder', { recursive: true, force: true });
})();
