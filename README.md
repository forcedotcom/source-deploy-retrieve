# Salesforce source-deploy-retrieve

[![CircleCI](https://circleci.com/gh/forcedotcom/source-deploy-retrieve.svg?style=svg&circle-token=8cab4c48eb81996544b9fa3dfa29e6734376b73f)](https://circleci.com/gh/forcedotcom/source-deploy-retrieve)
[![License](https://img.shields.io/badge/License-BSD%203--Clause-blue.svg)](https://opensource.org/licenses/BSD-3-Clause)
![npm (scoped)](https://img.shields.io/npm/v/@salesforce/source-deploy-retrieve)

Typescript Library to support the Salesforce extensions for VS Code.

Note: This library is in beta and has been released early so we can collect feedback. It may contain bugs, undergo major changes, or be discontinued.

## Development

Clone the project and `cd` into it. Ensure you have [Yarn](https://yarnpkg.com/) installed and run the following to build:

`yarn build`

To test the library in another local module, you can link it to such module so any changes that are built will be automatically present without reinstalling:

`yarn local:link /path/to/other/project`

to unlink the library:

`yarn local:unlink /path/to/other/project`

## Testing

### Running the test suite

`yarn test`

`yarn coverage` will also run the test suite but displays code coverage results at the end of a run. Run this to make sure your tests are providing adequate coverage.

> When running tests, code changes don't need to be built with `yarn build` first since the test suite uses ts-node as its runtime environment. Otherwise, you should run `yarn build` before manually testing changes.

### Testing with the NPM artifact

The library can also be installed to another local project as a regular NPM module. This is useful for manually testing the package that will be deployed to NPM. Use this instead of the linking process that's described under Development to QA changes before they are published:

`yarn local:install /path/to/other/package`
