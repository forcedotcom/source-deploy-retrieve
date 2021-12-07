import { CoverageObject } from '../../src/registry/types';
import { getCurrentApiVersion, getCoverage } from './shared';
import { registry as untypedRegistry } from '../../src';
import { MetadataRegistry } from '../../src';
import * as shell from 'shelljs';
import * as fs from 'fs';

(async () => {
  const currentApiVersion = await getCurrentApiVersion();
  const [currentCoverage, nextCoverage] = await Promise.all([
    getCoverage(currentApiVersion),
    getCoverage(currentApiVersion + 1),
  ]);
  const registry = untypedRegistry as MetadataRegistry;
  const registryTypes = Object.values(registry.types).flatMap((regType) => [
    regType,
    ...(regType.children ? Object.values(regType.children.types).map((child) => child) : []),
  ]);

  const inRegistry = (key: string) => registryTypes.some((regType) => regType.name === key);
  const filterNoMetadata = ([key, type]) => !type.channels.metadataApi.exposed;
  const filterFullCliSupport = ([key, type]) =>
    key.endsWith('Settings') ||
    (type.channels.metadataApi.exposed && type.channels.sourceTracking.exposed && inRegistry(key));
  const filterCliNoTracking = ([key, type]) =>
    !key.endsWith('Settings') &&
    type.channels.metadataApi.exposed &&
    !type.channels.sourceTracking.exposed &&
    inRegistry(key);
  const filterCliNoSupport = ([key, type]) =>
    !key.endsWith('Settings') &&
    type.channels.metadataApi.exposed &&
    type.channels.sourceTracking.exposed &&
    !inRegistry(key);

  const [currentOutput, nextOutput] = [currentCoverage, nextCoverage].map((coverage) => ({
    noMetadataAPI: Object.entries(coverage.types)
      .filter(filterNoMetadata)
      .map(([key, type]) => key),
    fullCliSupport: Object.entries(coverage.types)
      .filter(filterFullCliSupport)
      .map(([key, type]) => key),
    cliNoTracking: Object.entries(coverage.types)
      .filter(filterCliNoTracking)
      .map(([key, type]) => key),
    noCliSupport: Object.entries(coverage.types)
      .filter(filterCliNoSupport)
      .map(([key, type]) => key),
  }));

  const additionalCLISupport = Object.values(registryTypes)
    .filter((t) => !Object.keys(currentCoverage.types).includes(t.name))
    .filter((t) => !Object.keys(nextCoverage.types).includes(t.name))
    .map((t) => t.name);

  const getIconAndNote = (release: 'current' | 'next', key: string) => {
    const releaseOutput = release === 'current' ? currentOutput : nextOutput;
    if (releaseOutput.fullCliSupport.includes(key)) {
      return { icon: '✅', note: '' };
    }
    if (releaseOutput.noMetadataAPI.includes(key)) {
      return { icon: '❌', note: 'Not supported by CLI because no Metadata API support' };
    }
    if (releaseOutput.noCliSupport.includes(key)) {
      return { icon: '❌', note: 'Not supported by CLI, but support can be added' };
    }
    if (releaseOutput.cliNoTracking.includes(key)) {
      return { icon: '⚠️', note: 'Supports deploy/retrieve but not source tracking' };
    }
    return { icon: undefined, note: undefined };
  };
  const getCoverageRows = (coverageTypes: CoverageObject['types'], onlyNew = false) => {
    return Object.keys(coverageTypes)
      .sort()
      .filter((key) => (onlyNew ? !currentCoverage.types[key] : true))
      .map((typeName) => {
        const { icon, note } = getIconAndNote(onlyNew ? 'next' : 'current', typeName);
        return `|${typeName}|${icon}|${note}|`;
      });
  };

  const tableHeaders = ['|Metadata Type|Support|Notes|', '|:---|:---|:---|'];
  const contents = `# Supported CLI Metadata Types

This list compares metadata types found in Salesforce v${currentApiVersion}] with the metadata registry file includes in this repository.

Currently, there are ${currentOutput.fullCliSupport.length + currentOutput.cliNoTracking.length}/${
    Object.keys(currentCoverage.types).length
  } supported metadata types in Salesforce CLI.
We are constantly adding more support with the eventual goal of zero metadata gaps.
For status on any existing gaps, please search or file an issue in the [Salesforce CLI issues only repo](https://github.com/forcedotcom/cli/issues).

${tableHeaders.concat(getCoverageRows(currentCoverage.types)).join('\n')}



## Next Release (v${currentApiVersion + 1})
v${currentApiVersion + 1} introduces the following new types.  Here's their current level of support

${tableHeaders.concat(getCoverageRows(nextCoverage.types, true)).join('\n')}

## BonusTypes

The following types are supported by the CLI but not in the coverage reports for either version.  These are typically

- types that have been removed from the metadata API but were supported in previous versions
- types that exist only as a child type of other metadata types

${additionalCLISupport.map((t) => `- ${t}`).join('\n')}
`;

  await fs.promises.writeFile('METADATA_SUPPORT.md', contents);
  console.log('Wrote METADATA_SUPPORT.md');

  shell.exec(`git add METADATA_SUPPORT.md`);
  if (shell.exec(`git commit -am "chore: adding types for SDR" --no-verify`).code !== 0) {
    shell.echo(
      'Error: Git commit failed - usually nothing to commit which means there are no new metadata type support added in this version of SDR'
    );
  }
})().catch(console.error);
