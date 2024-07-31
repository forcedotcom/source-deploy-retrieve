BaseSourceAdapter

"Context"

- ownFolder (bool, default false, probably derivable from the type)
- type (probably a param for getComponent)
- registry
- forceIgnore
- tree

getComponent() // make a SC. Probably change `type` to be a param
populate() // add additional info to it, always called by getComponent

base

- parseAsRootMetadataXml (now a fn)
- parseMetadataXml (now a fn)
- getRootMetadataXmlPath (not implemented, all adapter have to implement or inherit)

### descendants

- Default
- MatchingContent
- MixedContent (overrides [populate, getRootMetadataXmlPath (only reference to OwnFolder)], provides an overrideable trimPathToContent to its children )
  -- Decomposed (ownFolded=true, overrides [getComponent, populate], inherits getRootMetadataXmlPath)
  -- Bundle (ownFolder=true, overrides populate (conditionally calling populate from MixedContent), inherits getRootMetadataXmlPath)
  --- DEB (overrides [getRootMetadataXmlPath, populate (which calls super.populate to use bundle's populate), parseMetadataXml]. Special impl of trimPathToContent)

---

# redesign

there are 2 getComponents (so far):

1. Base
2. Decomposed

Each starts with "find rootMetadata" (with overrideable functions for parseAsRootMetadataXml (always overridden),parseMetadataXml )

## real "getComponent" flow

1. findRootMetadata (parseAsRootMetadataXml, parseMetadataXml, OwnFolder?) => MetadataXml
2. get a component if there is rootMetadata (one of 2 options)
3. populate

## DEB

export class DigitalExperienceSourceAdapter extends BundleSourceAdapter {
protected getRootMetadataXmlPath(trigger: string): string {
if (this.isBundleType()) {
return this.getBundleMetadataXmlPath(trigger);
}
// metafile name = metaFileSuffix for DigitalExperience.
if (!this.type.metaFileSuffix) {
throw messages.createError('missingMetaFileSuffix', [this.type.name]);
}
return join(dirname(trigger), this.type.metaFileSuffix);
}

protected trimPathToContent(path: string): string {
if (this.isBundleType()) {
return path;
}
const pathToContent = dirname(path);
const parts = pathToContent.split(sep);
/_Handle mobile or tablet variants.Eg- digitalExperiences/site/lwr11/sfdc_cms\_\_view/home/mobile/mobile.json
Go back to one level in that case
Bundle hierarchy baseType/spaceApiName/contentType/contentApiName/variantFolders/file_/
const digitalExperiencesIndex = parts.indexOf('digitalExperiences');
if (digitalExperiencesIndex > -1) {
const depth = parts.length - digitalExperiencesIndex - 1;
if (depth === digitalExperienceBundleWithVariantsDepth) {
parts.pop();
return parts.join(sep);
}
}
return pathToContent;
}

protected populate(trigger: string, component?: SourceComponent): SourceComponent {
if (this.isBundleType() && component) {
// for top level types we don't need to resolve parent
return component;
}
const source = super.populate(trigger, component);
const parentType = this.registry.getParentType(this.type.id);
// we expect source, parentType and content to be defined.
if (!source || !parentType || !source.content) {
throw messages.createError('error_failed_convert', [component?.fullName ?? this.type.name]);
}
const parent = new SourceComponent(
{
name: this.getBundleName(source.content),
type: parentType,
xml: this.getBundleMetadataXmlPath(source.content),
},
this.tree,
this.forceIgnore
);
return new SourceComponent(
{
name: calculateNameFromPath(source.content),
type: this.type,
content: source.content,
xml: source.xml,
parent,
parentType,
},
this.tree,
this.forceIgnore
);
}

protected parseMetadataXml(path: SourcePath): MetadataXml | undefined {
const xml = super.parseMetadataXml(path);
if (xml) {
return {
fullName: this.getBundleName(path),
suffix: xml.suffix,
path: xml.path,
};
}
}

private getBundleName(contentPath: string): string {
const bundlePath = this.getBundleMetadataXmlPath(contentPath);
return `${parentName(dirname(bundlePath))}/${parentName(bundlePath)}`;
}

private getBundleMetadataXmlPath(path: string): string {
if (this.isBundleType() && path.endsWith(META_XML_SUFFIX)) {
// if this is the bundle type and it ends with -meta.xml, then this is the bundle metadata xml path
return path;
}
const pathParts = path.split(sep);
const typeFolderIndex = pathParts.lastIndexOf(this.type.directoryName);
// 3 because we want 'digitalExperiences' directory, 'baseType' directory and 'bundleName' directory
const basePath = pathParts.slice(0, typeFolderIndex + 3).join(sep);
const bundleFileName = pathParts[typeFolderIndex + 2];
const suffix = ensureString(
this.isBundleType() ? this.type.suffix : this.registry.getParentType(this.type.id)?.suffix
);
return `${basePath}${sep}${bundleFileName}.${suffix}${META_XML_SUFFIX}`;
}

private isBundleType(): boolean {
return this.type.id === 'digitalexperiencebundle';
}
}
