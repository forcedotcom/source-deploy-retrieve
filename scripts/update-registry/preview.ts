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
  // console.log(
  //   `${missingTypes.map((t) => `${t} (${nextCoverage.types[t].orgShapes.developer.features.join(';')})`).join('\n')}`
  // );

  const typesByFeature = new Map<string, string[]>();
  missingTypes.map((t) => {
    const featureLabel = nextCoverage.types[t].orgShapes.developer.features?.join(' & ') ?? 'NO FEATURE REQUIRED';
    typesByFeature.set(featureLabel, [...(typesByFeature.get(featureLabel) ?? []), t]);
  });
  console.log(typesByFeature);
  const formattedTypes: string[] = [];
  typesByFeature.forEach((types, feature) => {
    formattedTypes.push(`*${feature}*\n  -  ${types.join(', ')}`);
  });

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
          text: `There are ${missingTypes.length} new types not in the registry, organized by required features (if any).  Slack can show a max of 50.`,
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
  // console.log(JSON.stringify(json, null, 2));
  try {
    await got.post(process.env.DEFAULT_SLACK_WEBHOOK, {
      json,
    });
  } catch (e) {
    console.error(e);
  }
})();
