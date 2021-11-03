# Developing

## Getting Started

Clone the project and `cd` into it:

```
git clone git@github.com:forcedotcom/source-deploy-retrieve.git
cd source-deploy-retrieve
```

Ensure you have [Yarn](https://yarnpkg.com/) installed, then run:

```
yarn install
yarn build
```

## Branches

- Our released (_production_) branch is `main`
- Our work happens in _topic_ branches (feature and/or bug fix)
  - These branches are based on `main` and can live in forks for external contributors or within this repository for authors
  - Be sure to prefix branches in this repository with `<developer-name>/`
  - Be sure to keep branches up-to-date using `rebase`

## Testing

### Running the test suite

Runs the suite and output code coverage as a text summary:

```
yarn test
```

Utilize the `Run Tests` VS Code debugger configuration to run the test suite with the debugger enabled.

### Testing with the command line

Interact with the package exports on the command line by running:

```
yarn repl
```

This will start the NodeJS REPL with a few pre-set variables to conveniently interact
with exported modules. The REPL runs with the `--inspect` flag, allowing you to attach a debugger to the process. Select the `Attach to Remote` configuration in VS Code and click play to debug against it.

### Testing in another package

To test the library in another local package, you can link it to such module so any changes that are built will be automatically present without reinstalling:

```
yarn local:link /path/to/other/project
```

to unlink the library:

```
yarn local:unlink /path/to/other/project
```

### Testing with the NPM artifact

The library can also be installed to another local project as a regular NPM module. This is useful for manually testing the package that will be deployed to NPM. Use this instead of the linking process that's described under Development to QA changes before they are published:

```
yarn local:install /path/to/other/package
```

## Updating the registry

The tests include 2 registry-related tests.

### Validate the registry is correctly

Test failures here could be types that exist in the `types` section but don't have entries in `suffixes` or `strictDirectoryNames`.
It also checks that for types which share a suffix, only one can have non-strict directory (otherwise, how would you tell them apart)?

### Validate the registry is complete

The library uses the [registry file](../src/registry/metadataRegistry.json) to resolve how to process metadata types. This needs to be updated as new metadata types are added to the platform at major releases.

The completeness is checked by comparing the registry to the metadata coverage report, but excluding

1. Types that aren't supported in the metadata API
2. Types in the [nonSupportedTypes file](../src/registry/nonSupportedTypes.ts) (think of it as a registry-ignore file). You can ignore the types themselves, or the feature/settings they depend on. Be sure to explain why you're choosing to ignore that type.

### Adding new types to the registry

You can manually edit types in metadataRegistry.json. To simplify that work, there's a registry-building script - the script is, currently, unreliable

1. looks for missing types (similar to the completeness test)
2. For missing types, generate a project and scratch org that includes the Features/Settings
3. Running force:mdapi:describemetadata to get the describe
4. Modifying the registry to include the newly found types

```
`yarn update-registry`
```

NOTE:
inFolderTypes and types with childXml in their describe are not supported. You **want** to explore the various strategies for those and create NUTs.

### Tricks

- If you get a whole bunch of new types, you can "ignore" all the features and work through them in chunks (uncomment a feature at a time)
- Some features require modifications to the DevHub (licenses, etc) and some may have to stay ignored.
- You can use an existing org for the metadata describe.
  1. setting its alias to `registryBuilder`
  2. setting the env `RB_EXISTING_ORG` ex: `RB_EXISTING_ORG=true yarn update-registry`
