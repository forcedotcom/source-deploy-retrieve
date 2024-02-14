## Snapshot testing

There's a lot of metadata types, the registry is complex, and the conditional behavior of the metadata can be complicated. For example, having code to assert something like <https://github.com/forcedotcom/cli/issues/2448> (caused when changing xml=>js parsing libraries) is pretty unlikely.

The idea here is to have small projects that have mdapi packages and can convert them to/from source format. And then snapshot the (presumably correct) behavior to keep it from changing unexpectedly.

It's also more readable...if something changes, you can look at real files and diffs. As you make changes in SDR's source, you can see the impact in a real project.

## Create new sampleProjects

They're minimal sfdx project. They need an `sfdx-project.json`. Typically, I've started code in mdapi format (commit that) and then have the test convert to source and then back, snapshoting both results (the resulting package.xml is also included).

`sfdx-project.json` is important because it can affect the output (ex: apiVersion of the `package.xml`, packageDirs, `replacements` and registry customizations/presets).

Remove all the other files (.eslint, .github, .package.json, etc) to keep these small

## Initial snapshots

When there are no `__snapshots__` for your project, they're created when you first run the tests. After that, any change will cause the test to fail. You'll also see some `actual` files show up for easier diffing.

## Running

do one project: `yarn mocha test/snapshot/sampleProjects/nestedFolders/snapshots.test.ts`
do all snapshots: `yarn mocha test/snapshot/sampleProjects/**/*.test.ts`

## Caveats/Gotchas

It's snapshot-per-file for comparison. If your code changes cause expected files to not be produced, that doesn't get flagged. If your code causes new files, the tests won't fail but you _should_ notice them via git. Use `dirsAreIdentical` to compare folder descendate names/paths (does not compare their contents since that's what `snap` does)
