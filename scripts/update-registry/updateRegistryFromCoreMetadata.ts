import * as fs from 'node:fs';
import { CoverageObject } from '../../src/registry/types';
import { LooseDescribeEntry, DescribeEntry, DescribeFile } from './shared/types';
import { registryUpdate, isDefined, whatTypesNeedDescribe } from './shared/updateRegistry';

export let metadataCoverage: CoverageObject;

/** has suffix and directorName  */
const isCompleteEntry = (input: [string, LooseDescribeEntry]): input is [string, DescribeEntry] =>
  typeof input[1].directoryName === 'string' && typeof input[1].suffix === 'string';

// comes from https://sourcegraph.soma.salesforce.com/perforce.soma.salesforce.com/app/252/patch/core/-/blob/md-common-impl/test/func/results/cli-type-registry-info/cli-type-registry-info.json
const describeFile = Object.fromEntries(
  Object.entries(
    JSON.parse(fs.readFileSync('./scripts/update-registry/describe.json', 'utf8')) as unknown as DescribeFile
  ).filter(isCompleteEntry) // omit any children types
);

const getMissingTypesFromDescribe = async (missingTypes: string[]): Promise<DescribeEntry[]> =>
  missingTypes.map(logMissingEntry(describeFile)).filter(isDefined);

const logMissingEntry =
  (describe: typeof describeFile) =>
  (typeName: string): DescribeEntry | undefined => {
    const [, found] = Object.entries(describe).find(([key]) => key.toLowerCase() === typeName.toLowerCase()) ?? [];
    if (found !== undefined) {
      return found;
    }
    console.warn(`No entry for ${typeName}`);
  };

(async () => {
  const missingTypes = await whatTypesNeedDescribe();
  const missingTypesAsDescribeEntry = await getMissingTypesFromDescribe(missingTypes);
  (missingTypesAsDescribeEntry.length
    ? [`Updating types in the registry`, missingTypesAsDescribeEntry]
    : ['No metadata changes made']
  ).map((i) => console.log(i));
  registryUpdate(missingTypesAsDescribeEntry);
})();
