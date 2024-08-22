import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { whatTypesNeedDescribe, isDefined, registryUpdate } from './shared/updateRegistry';
import { DescribeEntry, DescribeResult } from './shared/types';

const execProm = promisify(exec);

const getMissingTypesAsDescribeResult = async (missingTypes: string[]): Promise<DescribeResult[]> => {
  const describeResult = await execProm('sf org list metadata-types -o registryBuilder --json');
  const metadataObjectsByName = new Map(
    (JSON.parse(describeResult.stdout).result.metadataObjects as DescribeResult[]).map((describeObj) => [
      describeObj.xmlName.toLowerCase(),
      describeObj,
    ])
  );
  // get the missingTypes from the describe
  return missingTypes.map(lowercaseFn).map(getOrWarn(metadataObjectsByName)).filter(isDefined);
};

/** massage for slight differences between the 2 types */
const describeResultToDescribeEntry = (describeResult: DescribeResult): DescribeEntry => ({
  ...describeResult,
  name: describeResult.xmlName,
  hasChildren: !!describeResult.childXmlNames?.length,
});

(async () => {
  if (process.argv.length < 3) {
    throw new Error(
      'Please provide the types to update the registry with.  Ex: `yarn update-registry-org CustomObject CustomField`'
    );
  }
  const missingTypes = await whatTypesNeedDescribe();

  const missingTypesAsDescribeResult = await getMissingTypesAsDescribeResult(missingTypes);
  registryUpdate(missingTypesAsDescribeResult.map(describeResultToDescribeEntry));
})();

const lowercaseFn = (s: string) => s.toLowerCase();

const getOrWarn =
  <T>(map: Map<string, T>) =>
  (key: string): T | undefined => {
    const result = map.get(key);
    if (result === undefined) {
      console.warn(`No entry for ${key}`);
      return;
    }
    return result;
  };
