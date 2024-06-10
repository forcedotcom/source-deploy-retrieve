import { CoverageObject, CoverageObjectType } from '../../src/registry/types';
import { getCurrentApiVersion, getCoverage } from '../../src/registry/coverage';
import { registry as untypedRegistry } from '../../src';
import { MetadataRegistry } from '../../src';
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
  const filterNoMetadata = ([key, type]: [string, CoverageObjectType]) => !type.channels.metadataApi.exposed;
  const filterFullCliSupport = ([key, type]: [string, CoverageObjectType]) =>
    key.endsWith('Settings') ||
    (type.channels.metadataApi.exposed && type.channels.sourceTracking.exposed && inRegistry(key));
  const filterCliNoTracking = ([key, type]: [string, CoverageObjectType]) =>
    !key.endsWith('Settings') &&
    type.channels.metadataApi.exposed &&
    !type.channels.sourceTracking.exposed &&
    inRegistry(key);
  const filterCliNoSupport = ([key, type]: [string, CoverageObjectType]) =>
    !key.endsWith('Settings') &&
    type.channels.metadataApi.exposed &&
    type.channels.sourceTracking.exposed &&
    !inRegistry(key);
  const filterCliNoSupportMetadataApiOnly = ([key, type]: [string, CoverageObjectType]) =>
    !key.endsWith('Settings') &&
    type.channels.metadataApi.exposed &&
    !type.channels.sourceTracking.exposed &&
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
    noCliSupportMetadataApiOnly: Object.entries(coverage.types)
      .filter(filterCliNoSupportMetadataApiOnly)
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
      return { icon: '❌', note: 'Not supported because the Metadata API support does not exist' };
    }
    if (releaseOutput.noCliSupport.includes(key)) {
      return { icon: '❌', note: 'Not supported, but support could be added' };
    }
    if (releaseOutput.noCliSupportMetadataApiOnly.includes(key)) {
      return { icon: '❌', note: 'Not supported, but support could be added (but not for tracking)' };
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

This list compares metadata types found in Salesforce v${currentApiVersion} with the [metadata registry file](./src/registry/metadataRegistry.json) included in this repository.

This repository is used by both the Salesforce CLIs and Salesforce's VSCode Extensions.

Currently, there are ${currentOutput.fullCliSupport.length + currentOutput.cliNoTracking.length}/${
    Object.keys(currentCoverage.types).length
  } supported metadata types.
For status on any existing gaps, please search or file an issue in the [Salesforce CLI issues only repo](https://github.com/forcedotcom/cli/issues).
To contribute a new metadata type, please see the [Contributing Metadata Types to the Registry](./contributing/metadata.md)

${tableHeaders.concat(getCoverageRows(currentCoverage.types)).join('\n')}



## Next Release (v${currentApiVersion + 1})

${
  Object.keys(nextCoverage.types).length
    ? `v${currentApiVersion + 1} introduces the following new types.  Here's their current level of support

${tableHeaders.concat(getCoverageRows(nextCoverage.types, true)).join('\n')}`
    : `> **Note**
> v${currentApiVersion + 1} coverage not available at this time`
}

## Additional Types

> The following types are supported by this library but not in the coverage reports for either version.  These are typically
>
> 1. types that have been removed from the metadata API but were supported in previous versions
> 1. types that are available for pilots but not officially part of the metadata API (use with caution)
> 1. types that exist only as a child type of other metadata types
> 1. settings types that are automatically supported

${additionalCLISupport.map((t) => `- ${t}`).join('\n')}
`;

  await fs.promises.writeFile('METADATA_SUPPORT.md', contents);
  console.log('Wrote METADATA_SUPPORT.md');
})().catch(console.error);
