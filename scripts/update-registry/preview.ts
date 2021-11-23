import { CoverageObject } from '../../src/registry/types';
import got from 'got';
import { getMissingTypes } from '../../test/utils/getMissingTypes';
import { registry } from '../../src';

(async () => {
  const currentApiVersion = (
    JSON.parse((await got(`https://mdcoverage.secure.force.com/services/apexrest/report`)).body) as {
      versions: { selected: number };
    }
  ).versions.selected;

  const nextCoverage = JSON.parse(
    (await got(`https://na${currentApiVersion - 8}.test1.pc-rnd.salesforce.com/mdcoverage/api.jsp`)).body
  ) as CoverageObject;

  const missingTypes = getMissingTypes(nextCoverage, registry).map((type) => type[0]);

  console.log(`There are ${missingTypes.length} new types for v${nextCoverage.apiVersion} not in the registry.`);
  console.log(
    `${missingTypes.map((t) => `${t} (${nextCoverage.types[t].orgShapes.developer.features.join(';')})`).join('\n')}`
  );
})();
