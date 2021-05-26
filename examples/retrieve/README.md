# Retrieving Components

This module provides code samples of how to retrieve metadata components.

## Component Merging

When retrieving components, a client has the option of merging the files of retrieved components with existing ones, or simply putting them in the default location inside of a target directory. For the sake of replicating `source:retrieve`, component merging is necessary.

First we have to construct a `ComponentSet` with components that are backed by local source files, then call `retrieve` with `merge: true`. If specifying components to merge, the `output` parameter becomes the default location to put retrieved components that did not match with any in the component set:

```typescript
// Components resolved from source
const localComponents = ComponentSet.fromSource('/path/to/force-app');

await localComponents.retrieve({
  usernameOrConnection: 'user@example.com',
  // place unmerged components in the leftovers directory
  output: path.join(process.cwd(), 'leftovers'),
  // components in the result that match with ones in the set should replace the latter
  merge: true
});
```

## Note on Replicating `source:retrieve` With a Manifest File

Source-backed components are generally speaking not required to retrieve. However, the behavior of the `source:retrieve` command is to replace any local components that match with those in the retrieve result, and any new components in a default package directory. The `fromManifest` initializer includes the `resolveSourcePaths` option as a convenience to resolve source-backed components that match entries in the given manifest file. 

A particular case to keep in mind when resolving source components with a manifest is when wildcards are encountered (fullName = `*`). The source resolution process interprets them as adding any component that is of the same type the wildcard is associated with to the set. However, there may be components in the org that are not local, and therefore cannot be added to the set during resolution. For this case, the wildcard needs to be added directly to the set as a component to ensure we retrieve new components as well. The option for this is `forceAddWildcards`:

```typescript
const components = await ComponentSet.fromManifest({
  manifestPath: '/path/to/package.xml ',
  // search "sfdx package directories" for local components that match the manifest
  resolveSourcePaths: ['/path/to/package1', '/path/to/package2'],
  // match all local components with the wildcard's type, but also add the wildcard itself
  forceAddWildcards: true
});

const result = await components
  .retrieve({
    usernameOrConnection: 'user@example.com',
    // output is the "default package directory" 
    output: '/path/to/package2',
    merge: true
  })
  .start();
```