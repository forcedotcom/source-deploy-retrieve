const fs = require('fs');
const { join } = require('path');

// Prep the registry
const REGISTRY_FILE = '../data/registry.json';
const EMPTY_REGISTRY = { types: {}, suffixes: {}, mixedContent: {} };
const registryPath = join(__dirname, REGISTRY_FILE);
const registry = fs.existsSync(registryPath)
  ? JSON.parse(fs.readFileSync(registryPath))
  : EMPTY_REGISTRY;

// TODO: Replace with api call
const describe = JSON.parse(
  fs.readFileSync(join(__dirname, '../data/describe.json'))
);

for (const object of describe.metadataObjects) {
  const typeId = object.xmlName.toLowerCase();
  const {
    xmlName: name,
    suffix,
    directoryName,
    inFolder,
    childXmlNames
  } = object;
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
  registry.suffixes[suffix] = typeId;

  if (!suffix) {
    registry.mixedContent[directoryName] = typeId;
  }
}

fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));

console.log('Registry updated');
