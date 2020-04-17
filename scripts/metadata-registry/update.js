const fs = require('fs');
const { join } = require('path');

// Prep the registry
const REGISTRY_PATH = join(
  __dirname,
  '..',
  '..',
  'src',
  'metadata-registry',
  'data',
  'registry.json'
);
const EMPTY_REGISTRY = { types: {}, suffixes: {}, mixedContent: {} };
const registry = fs.existsSync(REGISTRY_PATH)
  ? JSON.parse(fs.readFileSync(REGISTRY_PATH))
  : EMPTY_REGISTRY;

// TODO: Replace with api call
const describe = JSON.parse(fs.readFileSync(join(__dirname, 'describe.json')));

for (const object of describe.metadataObjects) {
  const typeId = object.xmlName.toLowerCase();
  const {
    xmlName: name,
    suffix,
    directoryName,
    inFolder,
    childXmlNames
  } = object;

  // If it's a type with folders, process the folder type later
  if (inFolder === 'true') {
    describe.metadataObjects.push({
      xmlName: `${name}Folder`,
      suffix: `${typeId}Folder`,
      directoryName,
      inFolder: false
    });
  }

  // populate the type
  registry.types[typeId] = {
    name,
    suffix,
    directoryName,
    childXmlNames:
      childXmlNames && !(childXmlNames instanceof Array)
        ? [childXmlNames]
        : childXmlNames,
    inFolder: inFolder === 'true'
  };

  // populate suffix index
  registry.suffixes[suffix] = typeId;

  // populate mixedContent index
  if (!suffix) {
    registry.mixedContent[directoryName] = typeId;
  }
}

fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2));

console.log('Registry updated');
