#!/usr/bin/env node

const fs = require('fs');
const deepmerge = require('deepmerge');
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

const registryErrata = JSON.parse(fs.readFileSync(join(__dirname, 'typeOverride.json')))

function createChildType(childXmlName) {
  const camelCase = childXmlName.substring(0, 1).toLowerCase() + childXmlName.substring(1);
  return {
    id: childXmlName.toLowerCase(),
    name: childXmlName,
    directoryName: `${camelCase}s`,
    suffix: camelCase,
  };
}

function populateChildRegistry(parentTypeId, childNames) {
  const childRegistry = registry.types[parentTypeId].children || {};
  const childTypeIndex = childRegistry.types || {};
  const childSuffixIndex = childRegistry.suffixes || {};
  const childDirectoryIndex = childRegistry.directories || {};

  for (const name of childNames) {
    const childTypeId = name.toLowerCase();
    let childType = createChildType(name);

    if (childTypeIndex[childTypeId]) {
      // override has been applied since here, so make existing entry the dominant one
      childType = deepmerge(childType, childTypeIndex[childTypeId]);
    }

    childTypeIndex[childTypeId] = childType;
    childSuffixIndex[childType.suffix] = childTypeId;
    childDirectoryIndex[childType.directoryName] = childTypeId;
  }

  registry.types[parentTypeId].children = childRegistry;
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
    if (!registry.types[typeId]) {
      registry.types[typeId] = {
        id: typeId,
        name,
        suffix,
        directoryName,
        inFolder: inFolder === 'true' || inFolder === true,
      }
    }

    // apply correction if one exists, and populate additional indexes afterwards
    if (registryErrata[typeId]) {
      registry.types[typeId] = deepmerge(registry.types[typeId], registryErrata[typeId])
    }

    if (childXmlNames) {
      const childNames = !(childXmlNames instanceof Array) ? [childXmlNames] : childXmlNames;
      populateChildRegistry(typeId, childNames);
    }

    const finalEntry = registry.types[typeId];

    // index file suffixes, otherwise require index type as requiring strict type folder 
    if (finalEntry.suffix) {
      // populate suffix index
      registry.suffixes[finalEntry.suffix] = typeId;
    } else {
      registry.strictTypeFolder[directoryName] = typeId;
    }
  }

  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2));

  console.log('Registry updated');
}

update();
