# Contributing Metadata Types to the Registry

You can view the existing metadata coverage by release using [METADATA_SUPPORT.md](../METADATA_SUPPORT.md)

- It can be updated by running
- The script runs daily via github actions. You only need to run it if you want to see the results of your registry changes.

```shell
yarn update-supported-metadata
```

Got questions?

- If you work for Salesforce, [#platform-cli](https://salesforce-internal.slack.com/archives/C01LKDT1P6J).
- If not, [open an issue](https://github.com/forcedotcom/cli/issues)

## Adding new types to the registry via a script

> NOTE: If you have a “Settings” metadata type, you do not need to follow these instructions. Support for your type is already built into SDR.

To simplify modifying the registry, there's a script.

> Note: The script depends on being able to create an org that will have your type. If you have a working org, but your type isn't compatible with scratch org, you can [use an existing org](#use-an-existing-org)

> Note: The script will use your default dev hub. If you don't have one, set one up. If you want to use a different hub, update your default.

The script will:

1. Look for missing types (similar to the completeness test)
2. For missing types, generate a project and scratch org that includes the Features/Settings
3. Run `sf org list metadata-types` to get the describe
4. Modify the registry to include the newly found types

```shell
yarn update-registry
```

### What the script can't do

inFolderTypes and types with childXml in their describe are not supported. You **want** to explore the various strategies for those (see the [SDR Handbook](../HANDBOOK.md) in this repo) and [create tests](#integration-testing) to validate that your types are being handled correctly.

For types that contain multiple files (e.g., bundles such as LWC, Aura, ExperienceBundle) where deleting 1 file should not delete the entire component you should set `supportsPartialDelete` on the type definition. For an example of this see the `ExperienceBundle` definition in `metadataRegistry.json`.

For those situations, refer to another existing type in the registry that you want yours to behave like.

If that's confusing, it's a great time to reach out to the CLI team.

## Manual Edits

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

There are 2 main ways this happens (or ways to make this work if it currently isn't)

1. A feature is available to scratch orgs when it previously wasn't
1. The metadata coverage report's "settings" were not sufficient to enable your type to appear in the `describe` call.

Fixing those problems not only makes it easier to automate your type's support in the library, but also makes your type usable by customers (features) and fixes your documentation (coverageReport).

## Manual Testing

Want to make sure your types are working as expected?

1. Create a new project with `sf project generate -n registryTest`
1. Create a scratch org `sf org create scratch`
1. Open the org and create your types.
1. Run `sf project deploy preview` and verify the remote add.
1. Run `sf project retrieve start` to pull the metadata and examine what is retrieved
1. Run `sf project deploy preview` and verify the changes were retrieved and no longer appear.
1. Delete the org `sf org delete scratch --no-prompt`
1. Create a new scratch org. `sf org create scratch`
1. Push the source `sf project deploy start`
1. Convert the source to mdapi format `sf project convert source -d mdapiOut`
1. Look in the resulting `metadataPackage_` and `package.xml` to see that it looks as expected
1. Deploy it to the org using `sfdx force:mdapi:deploy --deploydir mdapiOut --wait 30` and verify that it succeeds
1. Delete the source directory `rm -rf force-app/main/default/*`
1. Create a new scratch org and convert the source back
1. Convert back from mdapi to source format `sfdx force:mdapi:convert -r mdapiOut -d force-app`
1. `sfdx force:source:push`

### Caveats

Target types must be MDAPI addressable on the server. If they aren’t MDAPI addressable, special code is needed to support source tracking for these components. See the document [Metadata API Types: End to End, Cradle to Grave](https://confluence.internal.salesforce.com/display/PLATFORMDX/Metadata+API+Types%3A+End+to+End%2C+Cradle+to+Grave) (Salesforce internal only) for more details.

## Unit Testing

Reach out to the CLI team for help with unit tests.

[metadataResolver.ts](../test/resolve/metadataResolver.test.ts) is an example of unit testing one behavior (resolving from source files) of a real metadata type.

## Integration Testing

If you're doing anything complex (you've used any of the following properties `strategies`, `folderType`, `inFolder=true`, `ignoreParsedFullName`, `folderContentType`, `ignoreParentName`), you'll want to add some NUTs (not-unit-tests) that verify the behavior or your types using real orgs and to prevent SDR changes from causing regressions on your types.

[This NUT](https://github.com/salesforcecli/plugin-source/blob/main/test/nuts/territory2.nut.ts) validates the behavior for a particularly bizarre metadataType, territory2.

NUTs live in [plugin-source](https://github.com/salesforcecli/plugin-source) but run on branches to SDR.

See [testkit](https://github.com/salesforcecli/cli-plugins-testkit) for examples and usage.

# Tips and Tricks

### Work in stages

If you see a whole bunch of new unsupported types, you can "ignore" all the features and work through them in chunks (uncomment a feature at a time) using nonSupportedTypes.ts

If you want to update the registry for only a subset of the currently missing metadata types, add your types as arguments to the script.

```bash
# normal, update all missing types
yarn update-registry
# only update the 2 types listed
yarn update-registry AssessmentQuestion AssessmentQuestionSet
```

### DevHub settings

Some metadata types require features which require modifications to the DevHub (licenses, etc) and some may have to stay ignored (ex: a pilot feature you can't enable)

### Use an existing org

You can use an existing org for the metadata describe portion of the script by

1. setting its alias to `registryBuilder`
2. setting the env `RB_EXISTING_ORG` ex: `RB_EXISTING_ORG=true yarn update-registry`

### Steps to add your metadata in registry

## Prerequisites

    1. A sfdx project must exists in local.
      `sf project generate --name <projectname> --default-package-dir <directory> -x`
    2. An authorized devhub org must exists
      `sf org login web -a <alias> -r <localhost url> -d`
    3. A scratch org must exists with alias `registryBuilder`
      1. Update `project-scratch-def.json` as per your requirements.
      2. `sf org create scratch -f config/project-scratch-def.json -a registryBuilder -d`

## Steps

    1. Fork SourceDeployRetrieve github repo
      (https://github.com/forcedotcom/source-deploy-retrieve)
    2. Clone forked repo in local and checkout a new branch
    3. Setup Yarn
      1. Go to the repo directory
      2. Run `yarn install && yarn build`
    4. Setup an environment variable by executing command
      `export RB_EXISTING_ORG=true`
    5. Execute yarn update command for required metadata entities
      `yarn update-registry <MetadataEntity1> <MetadataEntity2>`
    6. Check if respective file(`src/registry/metadataRegistry.json`)
      got updated. `git status`

    Now changes are available in local, we have to link the registry with sfdx project

    8. From SDR git repo directory, run `yarn build; yarn link`
    9. Clone sfdx plugins repo (https://github.com/salesforcecli/plugin-source)
    10. Execute `yarn link @salesforce/source-deploy-retrieve` and `sfdx plugins:link .` from cloned plugins repo directory

    Registry has been set for your entities, now you can run `sfdx force:source` command for your entities:
    Proceed to `Manual Testing` section above in this document.
