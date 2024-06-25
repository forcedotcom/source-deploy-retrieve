BaseSourceAdapter

"Context"

- ownFolder (bool, default false, probably derivable from the type)
- type (probably a param for getComponent)
- registry
- forceIgnore
- tree

getComponent() // make a SC.  Probably change `type` to be a param
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
  -- Bundle (ownFolded=true, overrides populate (conditionally calling populate from MixedContent), inherits getRootMetadataXmlPath)
    --- DEB (overrides [getRootMetadataXmlPath, populate, parseMetadataXml].  Special impl of trimPathToContent)

---

# redesign

there are 2 getComponents (so far):

1. Base
2. Decomposed

Each starts with "find rootMetadata" (with overrideable functions for parseAsRootMetadataXml (always overridden),parseMetadataXml )

## real flow

1. findRootMetadata (parseAsRootMetadataXml, parseMetadataXml, OwnFolder?) => MetadataXml
2. get a component if there is rootMetadata (one of 2 options)
3. populate
