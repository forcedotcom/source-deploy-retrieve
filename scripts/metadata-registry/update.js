#!/usr/bin/env node

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

function createChildType(childXmlName) {
  const camelCase = childXmlName.substring(0, 1).toLowerCase() + childXmlName.substring(1);
  return {
    id: childXmlName.toLowerCase(),
    name: childXmlName,
    directoryName: `${camelCase}s`,
    suffix: camelCase,
  };
}

function update() {
  for (const object of describe.metadataObjects) {
    const typeId = object.xmlName.toLowerCase();
    const { xmlName: name, suffix, directoryName, inFolder, childXmlNames } = object;

    // If it's a type with folders, process the folder type later
    if (inFolder === 'true') {
      describe.metadataObjects.push({
        xmlName: `${name}Folder`,
        suffix: `${typeId}Folder`,
        directoryName,
        inFolder: false,
      });
    }

    // populate the type
    registry.types[typeId] = {
      id: typeId,
      name,
      suffix,
      directoryName,
      inFolder: inFolder === 'true',
    };
    if (childXmlNames) {
      registry.types[typeId].children = { types: {}, suffixes: {} };
      const childNames = !(childXmlNames instanceof Array) ? [childXmlNames] : childXmlNames;
      for (const child of childNames) {
        const childTypeId = child.toLowerCase();
        const childType = createChildType(child);
        registry.types[typeId].children.types[childTypeId] = childType;
        registry.types[typeId].children.suffixes[childType.suffix] = childTypeId;
      }
    }

    // populate suffix index
    registry.suffixes[suffix] = typeId;

    // populate mixedContent index
    if (!suffix) {
      registry.mixedContent[directoryName] = typeId;
    }
  }

  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2));

  console.log('Registry updated');
}

update();
