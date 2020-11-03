const fs = require('fs');
const path = require('path');
const deepmerge = require('deepmerge');

function initializeChildRegistry(type, childNames) {
  if (!type.children) type.children = {};
  if (!type.children.types) type.children.types = {};
  if (!type.children.suffixes) type.children.suffixes = {};
  if (!type.children.directories) type.children.directories = {};

  const createChildType = (childName) => {
    const camelCase = childName.substring(0, 1).toLowerCase() + childName.substring(1);
    return {
      id: childName.toLowerCase(),
      name: childName,
      directoryName: `${camelCase}s`,
      suffix: camelCase,
    };
  }

  for (const name of childNames) {
    const childTypeId = name.toLowerCase();
    const childType = type.children.types[childTypeId] || createChildType(name);

    type.children.types[childTypeId] = childType;
    type.children.suffixes[childType.suffix] = childTypeId;
    type.children.directories[childType.directoryName] = childTypeId;
  }
}

function update(registry, describeResult) {
  const typeOverrides = JSON.parse(fs.readFileSync(path.join(__dirname, 'typeOverride.json')))

  for (const object of describeResult.metadataObjects) {
    const typeId = object.xmlName.toLowerCase();
    const { xmlName: name, suffix, directoryName, inFolder, childXmlNames } = object;

    // If it's a type with folders, process the folder type later
    if (inFolder === 'true') {
      describeResult.metadataObjects.push({
        xmlName: `${name}Folder`,
        suffix: `${typeId}Folder`,
        directoryName,
        inFolder: false,
      });
    }

    let type = registry.types[typeId] || {
      id: typeId,
      name,
      suffix,
      directoryName,
      inFolder: inFolder === 'true' || inFolder === true,
      strictDirectoryName: !suffix
    };

    // apply type override if one exists
    if (typeOverrides[typeId]) {
      type = deepmerge(type, typeOverrides[typeId])
    }

    if (childXmlNames) {
      const childNames = !(childXmlNames instanceof Array) ? [childXmlNames] : childXmlNames;
      initializeChildRegistry(type, childNames, registry);
    }

    registry.types[typeId] = type

    // index file suffixes, otherwise require index type as requiring strict type folder
    if (type.suffix) {
      registry.suffixes[type.suffix] = typeId;
    } else {
      registry.strictDirectoryNames[type.directoryName] = typeId;
    }
  }
}

module.exports = update;