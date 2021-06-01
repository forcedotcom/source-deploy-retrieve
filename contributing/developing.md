# Developing

## Getting Started

Clone the project and `cd` into it:

```
$ git clone git@github.com:forcedotcom/source-deploy-retrieve.git
$ cd source-deploy-retrieve
```

Ensure you have [Yarn](https://yarnpkg.com/) installed, then run:

```
$ yarn install
$ yarn build
```

## Branches

- We work in `develop`
- Our released (_production_) branch is `main`
- Our work happens in _topic_ branches (feature and/or bug fix)
  - These branches are based on `develop` and can live in forks for external contributors or within this repository for authors
  - Be sure to prefix branches in this repository with `<developer-name>/`
  - Be sure to keep branches up-to-date using `rebase`

## Testing

### Running the test suite

`yarn test` runs the suite and outputs code coverage as a text summary. Utilize the `Run Tests` VS Code debugger configuration to enable the debugger and run the test suite.

<br>

### Testing with the command line

Interact with the package exports on the command line by running:

`yarn repl`

This will start the NodeJS REPL with a few pre-set variables to conveniently interact
with exported modules. The REPL runs with the `--inspect` flag, allowing you to attach a debugger to the process. Select the `Attach to Remote` configuration in VS Code and click play to debug against it.

<br>

### Testing in another package

To test the library in another local package, you can link it to such module so any changes that are built will be automatically present without reinstalling:

`yarn local:link /path/to/other/project`

to unlink the library:

`yarn local:unlink /path/to/other/project`

<br>

### Testing with the NPM artifact

The library can also be installed to another local project as a regular NPM module. This is useful for manually testing the package that will be deployed to NPM. Use this instead of the linking process that's described under Development to QA changes before they are published:

`yarn local:install /path/to/other/package`

<br>

## Updating the registry

The library uses the [registry file]('../src/registry/registry.json') to resolve how to process metadata types. This needs to be updated on every mayor platform release to add all the new metadata types. Run the command below against an org on the latest platform API version:

`yarn update-registry <api version e.g. 51.0> -u <username>`
