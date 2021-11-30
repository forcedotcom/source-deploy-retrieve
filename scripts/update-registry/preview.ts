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

  const typesByFeature = new Map<string, string[]>();
  missingTypes.map((t) => {
    const featureLabel = nextCoverage.types[t].orgShapes.developer.features?.join(' & ') ?? 'NO FEATURE REQUIRED';
    typesByFeature.set(featureLabel, [...(typesByFeature.get(featureLabel) ?? []), t]);
  });
  console.log(typesByFeature);
  const formattedTypes = Array.from(typesByFeature, ([feature, types]) => `*${feature}*\n - ${types.join('\n - ')}`);

  const json = {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `v${nextCoverage.apiVersion} Metadata Preview`,
        },
      },
      {
        type: 'section',
        text: {
          type: 'plain_text',
          text: `There are ${missingTypes.length} new types not in the registry, organized by required features (if any).`,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: formattedTypes.join('\n\n'),
        },
      },
    ],
  };
  try {
    await got.post(process.env.DEFAULT_SLACK_WEBHOOK, {
      json,
    });
  } catch (e) {
    console.error(e);
  }
})();
