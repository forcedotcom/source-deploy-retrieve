# Resolving Components

This module provides code samples of how to resolve metadata components.

Component resolution refers to constructing objects adhering to the `MetadataComponent` interface or its subtypes. Components are used in nearly every operation in some way. A metadata component can either be associated with metadata files or not. The former is an instance of the `SourceComponent` class or a subtype of it. Some operations, like deploying, require source-backed components since files are required to be sent to the org. Retrieve on the other-hand does not require source-backed components, since all that needs to be done is tell the org which components the client wants.

While a client may be capable of resolving their own components, there are a handful of built-in mechanisms for doing so.

## Source-backed Component Resolution

Components can be resolved from metadata source files - both "source format" and "metadata format" are supported (see [Salesforce DX Project Structure and Source Format](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_source_file_format.htm)). The most convenient way to resolve components from one or more file paths is by using the `ComponentSet.fromSource` initializer:

```typescript
const components = ComponentSet.fromSource('/path/to/force-app/main/default/classes');
```

This will automatically build a unique collection of components. A client may then perform common operations such as deploying and retrieving the resolved components from the component set object. Note that "unique" in a component set means only one instance of a fullName and type pair. Multiple source-backed components referring to the same fullName and type pair may coexist in the same set - in fact this is how splitting a CustomObject across multiple package directories in SFDX is achieved.

The component set initializer is simply a wrapper of the underlying source resolver logic, with the added benefit of creating a unique collection of components. If all a client is interested in is analyzing components, we recommend potentially using the `MetadataResolver` directly. While there isn't a ton of extra overhead in constructing a `ComponentSet`, if a client's functionality doesn't require one it may be more beneficial from a performance standpoint:


```typescript
const sourceResolver = new MetadataResolver();
const components: SourceComponent[] = sourceResolver.resolve('/path/to/force-app');

// resolve only LightningComponentBundle components
const filter = new ComponentSet([{ fullName: '*', type: 'LightningComponentBundle' }]);
const lwc = sourceResolver.resolve('/path/to/force-app', filter);
```

## Non-source-backed Component Resolution

Another common use-case is parsing components from a manifest file. Similar to source resolution, there are two ways of doing so:

```typescript
// use the ComponentSet initializer
const set = ComponentSet.fromManifest('/path/to/package.xml');

// or use the resolver directly
const manifestResolver = new ManifestResolver();
const components: MetadataComponent[] = await manifestResolver.resolve('/path/to/package.xml');
```

Keep in mind that the resolvers do not guarantee uniqueness themselves, that is where the component set initializer is helpful. If a file has duplicate member entries, they will be included as-is in the resolver result.


## Mixed Resolution

Sometimes we need to resolve both kinds of components, and the component set initializers provide a convenient way of accomplishing this. e.g. If we want to resolve source components for as many members in a manifest file we can:

```typescript
const components = await ComponentSet.fromManifest({
  manifestPath: '/path/to/package.xml',
  resolveSourcePaths: [
    '/path/to/force-app',
    '/path/to/some-other-folder-with-components'
  ]
});
```

This will add all members in the manifest as components, and will replace it with source-backed versions if found in one of the given file paths.


## Tree Containers

A `TreeContainer` is an encapsulation of a file system that enables I/O against anything that can be abstracted as one. The implication is a client can resolve source-backed components against alternate file system abstractions. By default for most operations, the `NodeFSTreeContainer` is used, which is simply a wrapper of the Node file system api calls. There is also the `ZipTreeContainer`, which is used for scanning components against the central directory of a zip file, and the `VirtualTreeContainer`, helpful for creating mock components in testing scenarios.

Clients can implement new tree containers by extending the `TreeContainer` base class and expanding existing functionality.

### Mocking Components With the VirtualTreeeContainer

If a client needs to create fake components for testing, the `VirtualTreeContainer` is a great way to do so without having to create real local files in a project.

```typescript
const virtualTree = new VirtualTreeContainer([
  {
    dirPath: '/',
    children: ['MyClass.cls', 'MyClass.cls-meta.xml', 'folder2']
  },
  {
    dirPath: '/folder2',
    children: ['MyClass2.cls', 'MyClass2.cls-meta.xml']
  }
]);

const components = ComponentSet.fromSource({
  fsPaths: ['/'],
  tree: virtualTree
});

components.toArray() // => [<MyClass>, <MyClass2>]
```

Alternatively, one can create individual components with the `SourceComponent.createVirtualComponent` static method:

```typescript
// use the registry to assign a type
import { SourceComponent, registry } from '@salesforce/source-deploy-retrieve';

const virtualFs: VirtualDirectory[] = [
  {
    dirPath: '/metadata',
    children: [
      {
        name: 'MyLayout.layout',
        data: Buffer.from('<Layout></Layout>')
      }
    ]
  }
]
const layout = SourceComponent.createVirtualComponent({
  name: 'MyLayout',
  type: registry.types.layout,
  xml: '/metadata/MyLayout.layout'
}, virtualFs);

console.log(await layout.parseXml()) // => "<Layout></Layout>"
```
