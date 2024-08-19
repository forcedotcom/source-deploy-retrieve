# Contributing Metadata Types to the Registry

You can view the existing metadata coverage by release using [METADATA_SUPPORT.md](../METADATA_SUPPORT.md)

- The script runs daily via github actions. You only need to run it if you want to see the results of your registry changes.
- It can be updated by running

```shell
yarn update-supported-metadata
```

## Project Setup

1. Fork [SourceDeployRetrieve github repo](https://github.com/forcedotcom/source-deploy-retrieve)
1. Clone forked repo in local and checkout a new branch
1. Setup Yarn
   1. Go to the repo directory
   1. Run `yarn install && yarn build`

## Adding new types to the registry via a script

> NOTE: If you have a “Settings” metadata type, you do not need to follow these instructions. Support for your type is already built into SDR.

### Path 1: Using Core Metadata

There exists a test in Core `GenerateCLITypeRegistryInfoTest` that generates a file `cli-type-registry-info.json`.

The test is manually run, the file is committed to `patch`, and the output is manually copied to `../scripts/update-registry/describe.json` in SDR.

If your metadata type is simple and already in the file, run `yarn update-registry-org <MetadataEntity1> <MetadataEntity2>` (you'll see warnings if your type is missing or too complex for the script to handle)

### Path 2: Using Describe from an Org

> Note: The script asks your org for describe information about your type. Make sure that `sf org list metadata-types` returns the correct information for your type.

The script will:

1. Look for missing types (similar to the completeness test) OR the types you specify
1. Run `sf org list metadata-types` to get the describe
1. Modify the registry to include the newly found types

```shell
sf alias set registryBuilder=<the org's username>
yarn update-registry-org <MetadataEntity1> <MetadataEntity2>
```

You can set the environment variable `SF_ORG_API_VERSION` if you want to specify an API version.

### Results

You should see updates to `src/registry/metadataRegistry.json` (check `git status`)

### What the script can't do

inFolderTypes and types with childXml in their describe are not supported. You **want** to explore the various strategies for those (see the [SDR Handbook](../HANDBOOK.md) in this repo) and [create tests](#integration-testing) to validate that your types are being handled correctly.

For types that contain multiple files (e.g., bundles such as LWC, Aura, ExperienceBundle) where deleting 1 file should not delete the entire component you should set `supportsPartialDelete` on the type definition. For an example of this see the `ExperienceBundle` definition in `metadataRegistry.json`.

For those situations, refer to another existing type in the registry that you want yours to behave like.

If that's confusing, it's a great time to reach out to the CLI team.

## Manual Edits

> only do this if the script can't handle our type OR your type isn't in the CoverageReport yet and the script won't see it

You can do what the script does yourself. As you work, run `./node_modules/mocha/bin/mocha test/registry/registryValidation.test.ts` to check your entries

Run `sf org list metadata-types --json` to get the describe. `>` the output to a file or pipe it to [jq](https://stedolan.github.io/jq/) (`| jq`) to find your type.

Your describe will contain something like this

```js
{
    "directoryName": "yourTypes",
    "inFolder": "false",
    "metaFile": "false",
    "suffix": "yourtype",
    "xmlName": "YourNewType"
},
```

Entries in the `describe.json` have the following shape:
| Property | Description|
| --- | --- |
|childXmlNames | List of child sub-components for this component|
|directoryName | The name of the directory in the .zip file that contains this component.|
| inFolder | Indicates whether the component is in a folder (true) or not (false). For example, documents, email templates and reports are stored in folders.|
|metaFile| Indicates whether the component requires an accompanying metadata file. For example, documents, classes, and s-controls are components that require an additional metadata file.|
|suffix| The file suffix for this component.|
|xmlName| The name of the root element in the metadata file for this component. This name also appears in the Packages > types > name field in the manifest file package.xml.|

Create an entry in the `types` property:

> this fictitious type COULD HAVE used the automated script

```js
"yournewtype": { // the key is lowercased xmlName
      "id": "yournewtype", // lowercased xmlName
      "name": "YourNewType", // xmlName
      "suffix": "yourtype", // suffix
      "directoryName": "yourTypes", //directoryName
      "inFolder": false, // inFolder
      "strictDirectoryName": false // set to true when suffixes are not unique in the registry
},
```

add a matching entry in `suffixes`

```js
  "yourtype": "yournewtype" // "suffix": "id"
```

### When suffixes aren't unique

If your type uses a suffix already in use, tell SDR to use the `directoryName` as well by setting `"strictDirectoryName"` : `"true"`

Then also add an entry in the `strictDirectoryNames` section.

```json
  "yourtype" : "yournewtype" // "directory" : "id"

```

To preserve existing behavior, use `strictDirectoryName` on the new types, not the old ones.

# Testing

SDR includes 2 registry-related tests to check your changes to the metdataRegistry.json

## Validate the registry is correct

`yarn mocha test/registry/registryValidation.test.ts`

Test failures here could be types that exist in the `types` section but don't have entries in `suffixes` or `strictDirectoryNames`.
It also checks that suffixes are unique OR only one type that shares a suffix isn't `strictDirectoryName`.

## Validate the registry is complete

`yarn test:registry`

The library uses the [registry file](../src/registry/metadataRegistry.json) to resolve how to process metadata types. This needs to be updated as new metadata types are added to the platform at major releases.

The completeness is checked by comparing the registry to the metadata coverage report, but excluding

1. Types that aren't supported in the metadata API
2. Types in the [nonSupportedTypes file](../src/registry/nonSupportedTypes.ts) (think of it as a registry-ignore file). You can ignore the types themselves, or the feature/settings they depend on. Be sure to explain why you're choosing to ignore that type.

If you find your types (or the features they require) excluded by `nonSupportedTypes.ts` but think they're ready to go, feel free to remove them from the list.

## Manual Testing

Want to make sure your types are working as expected?

### Path 1 (replace the registry in your CLI)

1. find where your CLI has `metadataRegistry.json`. This varies based on how you installed the CLI and your machine. For example, using the installers on a mac, the registry is in ~/.local/share/sf/client/current/node_modules/@salesforce/source-deploy-retrieve/lib/src/registry/metadataRegistry.json
1. copy your modified registry from SDR over the existing file in your CLI

### Path 2 (patch the registry via registryCustomizations)

1. Create a new project with `sf project generate -n registryTest`
1. Open the generated `sfdx-project.json` and add a property `registryCustomizations`. Its shape is the same as the Metadata Registry, and it is treated as a "patch" for the default registry. If you generated registry changes above, you can add just those changes to `registryCustomizations`.
   1. suffixes
   1. strictDirectoryNames (could be empty if your new type doesn't use this)
   1. childTypes (could be empty if your new type doesn't use this)
   1. types

### Sample validation

1. Create a scratch org `sf org create scratch` (edit the scratch org definition file if your types needs features/settings)
1. Open the org and create your types.
1. Run `sf project retrieve preview` and verify the remote add.
1. Run `sf project retrieve start` to pull the metadata and examine what is retrieved
1. Run `sf project retrieve preview` and verify the changes were retrieved and no longer appear.
1. Delete the org `sf org delete scratch --no-prompt`
1. Create a new scratch org. `sf org create scratch`
1. Push the source `sf project deploy start`
1. Convert the source to mdapi format `sf project convert source -d mdapiOut`
1. Look in the resulting `mdapiOut` directory and the `package.xml` to see that it looks as expected
1. Deploy it to the org using `sf project deploy start --metadata-dir mdapiOut --wait 30` and verify that it succeeds
1. Delete the source directory `rm -rf force-app/main/default/*`
1. Create a new scratch org and convert the source back
1. Convert back from mdapi to source format `sf project convert mdapi -r mdapiOut -d force-app`
1. `sf project deploy start`

### Caveats

Target types must be MDAPI addressable on the server. If they aren’t MDAPI addressable, special code is needed to support source tracking for these components. See the document [Metadata API Types: End to End, Cradle to Grave](https://confluence.internal.salesforce.com/display/PLATFORMDX/Metadata+API+Types%3A+End+to+End%2C+Cradle+to+Grave) (Salesforce internal only) for more details.

## Unit Testing

[metadataResolver.ts](../test/resolve/metadataResolver.test.ts) is an example of unit testing one behavior (resolving from source files) of a real metadata type.

We don't recommend additional UT for anything the script generated. But if you had a complex type, reach out to the CLI team for help with unit tests.

## Integration Testing

If you're doing anything complex (you've used any of the following properties `strategies`, `folderType`, `inFolder=true`, `ignoreParsedFullName`, `folderContentType`, `ignoreParentName`), you'll want to add some NUTs (not-unit-tests) that verify the behavior or your types using real orgs and to prevent SDR changes from causing regressions on your types.

[This NUT](https://github.com/salesforcecli/plugin-deploy-retrieve/blob/main/test/nuts/specialTypes/territory2.nut.ts) validates the behavior for a particularly bizarre metadataType, territory2.

NUTs live in [plugin-deploy-retrieve](https://github.com/salesforcecli/plugin-deploy-retrieve) but run on branches to SDR.

See [testkit](https://github.com/salesforcecli/cli-plugins-testkit) for examples and usage.

## Got questions?

- If you work for Salesforce,
  - For general questions, post in [#platform-cli](https://salesforce-internal.slack.com/archives/C01LKDT1P6J)
  - For PR reviews, post in [#platform-cli-collaboration](https://salesforce.enterprise.slack.com/archives/C06V045BZD0)
- If not, [open an issue](https://github.com/forcedotcom/cli/issues)
