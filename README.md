# Salesforce source-deploy-retrieve

[![CircleCI](https://circleci.com/gh/forcedotcom/source-deploy-retrieve.svg?style=svg&circle-token=8cab4c48eb81996544b9fa3dfa29e6734376b73f)](https://circleci.com/gh/forcedotcom/source-deploy-retrieve)
[![License](https://img.shields.io/badge/License-BSD%203--Clause-blue.svg)](https://opensource.org/licenses/BSD-3-Clause)
![npm (scoped)](https://img.shields.io/npm/v/@salesforce/source-deploy-retrieve)
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)

## Introduction

A JavaScript toolkit for working with Salesforce metadata. Built to support the SFDX deploy and retrieve experience in the [Salesforce VS Code Extensions](https://github.com/forcedotcom/salesforcedx-vscode), CLI plugins, and other tools working with metadata.

## Features

- Resolve Salesforce metadata files into JavaScript objects
- Parse and generate [manifest files](https://trailhead.salesforce.com/en/content/learn/modules/package-xml/package-xml-adventure)
- Convert source files between [SFDX File Formats](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_source_file_format.htm)
- Generate metadata packages with the option to automatically create a zip file
- Deploy and retrieve metadata with an org
- An [index](./src/registry/registry.json) to reference available metadata types.
- Utilize promises with `async/await` syntax

## Usage

Install the package:

```
npm install @salesforce/source-deploy-retrieve
```

Examples:

```typescript
const { ComponentSet } = require('@salesforce/source-deploy-retrieve');

// Deploy a local set of Apex classes to an org
const deployResult = await ComponentSet
  .fromSource('/dev/MyProject/force-app/main/default/classes')
  .deploy({ usernameOrConnection: 'user@example.com' })
  .start();

// Retrieve metadata defined in a manifest file
const retrieveResult = await ComponentSet
  .fromManifest('/dev/my-project/manifest/package.xml')
  .retrieve({
    usernameOrConnection: 'user@example.com'
    output: '/dev/retrieve-result'
  })
  .start();

// Search for a particular CustomObject
const myObject = ComponentSet
  .fromSource([
    '/dev/my-project/force-app',
    '/dev/my-project/force-app-2'
  ])
  .find(component => {
    return component.fullName === 'MyObject__c' && component.type.name === 'CustomObject')
  });
```

See the [examples](./examples) folder for more code samples and guides.
See the [API documentation](https://forcedotcom.github.io/source-deploy-retrieve/) for details on how to effectively use and integrate SDR.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for details on how to contribute to the library.

See [developing.md](./contributing/developing.md) for details on building and testing the library locally.
