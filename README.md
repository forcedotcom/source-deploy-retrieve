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
- An [index](./src/registry/metadataRegistry.json) to reference available metadata types.
- Utilize promises with `async/await` syntax

## Usage

Install the package:

```
npm install @salesforce/source-deploy-retrieve
```

See [HANDBOOK.md](./HANDBOOK.md) for usage and examples.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for details on how to contribute to the library.

See [developing.md](./contributing/developing.md) for details on building and testing the library locally.

## Publishing

SDR publishes when changes are merged into `main`. The version is bumped per the rules of the release orb and [standard-version](https://github.com/conventional-changelog/standard-version).
