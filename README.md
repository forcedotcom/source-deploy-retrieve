# Salesforce source-deploy-retrieve

[![CircleCI](https://circleci.com/gh/forcedotcom/source-deploy-retrieve.svg?style=svg&circle-token=8cab4c48eb81996544b9fa3dfa29e6734376b73f)](https://circleci.com/gh/forcedotcom/source-deploy-retrieve)
[![License](https://img.shields.io/badge/License-BSD%203--Clause-blue.svg)](https://opensource.org/licenses/BSD-3-Clause)
![npm (scoped)](https://img.shields.io/npm/v/@salesforce/source-deploy-retrieve)
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)

Typescript Library to support the Salesforce extensions for VS Code.

Note: This library is in beta and has been released early so we can collect feedback. It may contain bugs, undergo major changes, or be discontinued.

## Development

Clone the project and `cd` into it. Ensure you have [Yarn](https://yarnpkg.com/) installed and run the following to build:

`yarn build`



## Testing

### Running the test suite

`yarn test` runs the suite and outputs code coverage as a text summary

### Testing with the command line

Interact with the package exports on the command line by running:

`yarn repl`

This will start the NodeJS REPL with a few pre-set variables to conveniently interact
with exported modules. The REPL runs with the `--inspect` flag, allowing you to attach a debugger to the process. Select the `Attach to Remote` configuration in VS Code and click play to debug against it.

### Testing with another module

To test the library in another local module, you can link it to such module so any changes that are built will be automatically present without reinstalling:

`yarn local:link /path/to/other/project`

to unlink the library:

`yarn local:unlink /path/to/other/project`

### Testing with the NPM artifact

The library can also be installed to another local project as a regular NPM module. This is useful for manually testing the package that will be deployed to NPM. Use this instead of the linking process that's described under Development to QA changes before they are published:

`yarn local:install /path/to/other/package`

### Updating the registry

The library uses a registry to resolve how to process metadata types. This needs to be updated on every mayor platform release to add all the new metadata types. Run the command below against an org in the latest platform version.

`yarn update-registry <api version e.g. 51.0> -u <username>`
