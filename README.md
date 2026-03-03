# Salesforce source-deploy-retrieve

[![License](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](https://opensource.org/license/apache-2-0)
![npm (scoped)](https://img.shields.io/npm/v/@salesforce/source-deploy-retrieve)
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)

## Introduction

A JavaScript toolkit for working with Salesforce metadata. Built to support the Salesforce CLI deploy and retrieve experience in the [Salesforce VS Code Extensions](https://github.com/forcedotcom/salesforcedx-vscode), CLI plugins, and other tools working with metadata.

## Features

- Resolve Salesforce metadata files into JavaScript objects
- Parse and generate [manifest files](https://trailhead.salesforce.com/en/content/learn/modules/package-xml/package-xml-adventure)
- Convert source files between [SFDX File Formats](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_source_file_format.htm)
- Generate metadata packages with the option to automatically create a zip file
- Deploy and retrieve metadata with an org
- An [index](./src/registry/metadataRegistry.json) to reference available metadata types.
- Utilize promises with `async/await` syntax

## Web Applications

SDR supports the WebApplication metadata type for deploying and retrieving web app bundles (HTML, JS, CSS, etc.) to a Salesforce org.

- **Bundle structure:** Each app lives under `force-app/main/default/webapplications/{AppName}/` with required `{AppName}.webapplication-meta.xml` and optional `webapplication.json`
- **webapplication.json:** Configures `outputDir` (where built files live), `routing` (rewrites, redirects, fallback), and `headers`. Validated on deploy; optional for file-based routing
- **Deploy/retrieve:** Use `sf project deploy start` or `sf project retrieve start` with a source path or manifest. WebApplication is resolved as a bundle type
- **Destructive changes:** Use `--post-destructive-changes` with a manifest listing `WebApplication` components to delete apps from the org

See [docs/WEBAPPLICATION.md](./docs/WEBAPPLICATION.md) for bundle structure, `webapplication.json` schema, and examples.

## Issues

Please report all issues to the [issues only repository](https://github.com/forcedotcom/cli/issues).

## Usage

Install the package:

```
npm install @salesforce/source-deploy-retrieve
```

See [HANDBOOK.md](./HANDBOOK.md) for usage and examples.

See [API Docs](https://forcedotcom.github.io/source-deploy-retrieve)

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for details on how to contribute to the library.

See [developing.md](./contributing/developing.md) for details on building and testing the library locally.

## Publishing

SDR publishes when changes are merged into `main`. The version is bumped per the rules of the release orb and [standard-version](https://github.com/conventional-changelog/standard-version).
