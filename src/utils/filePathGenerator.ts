/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { join, sep } from 'path';
import { MetadataComponent } from '../resolve/types';
import { META_XML_SUFFIX } from '../common/constants';
import { RegistryAccess } from '../registry/registryAccess';
import { registry } from '..';
const registryAccess = new RegistryAccess();

export const filePathsFromMetadataComponent = (
  { fullName, type }: MetadataComponent,
  packageDir?: string
): string[] => {
  const packageDirWithTypeDir = packageDir ? join(packageDir, type.directoryName) : type.directoryName;

  if (type.strategies?.adapter === 'decomposed') {
    return [join(packageDirWithTypeDir, `${fullName}${sep}${fullName}.${type.suffix}${META_XML_SUFFIX}`)];
  }

  // this needs to be done before the other types because of potential overlaps
  if (!type.children && Object.keys(registry.childTypes).includes(type.id)) {
    return getDecomposedChildType({ fullName, type }, packageDir);
  }

  // basic metadata (with or without folders)
  if ((!type.children && !type.strategies) || type.strategies.transformer === 'nonDecomposed') {
    return (type.inFolder || type.folderType ? generateFolders({ fullName, type }, packageDirWithTypeDir) : []).concat([
      join(packageDirWithTypeDir, `${fullName}.${type.suffix}${META_XML_SUFFIX}`),
    ]);
  }

  // matching content (with or without folders)
  if (type.strategies?.adapter === 'matchingContentFile') {
    return (type.inFolder ? generateFolders({ fullName, type }, packageDirWithTypeDir) : []).concat([
      join(packageDirWithTypeDir, `${fullName}.${type.suffix}${META_XML_SUFFIX}`),
      join(packageDirWithTypeDir, `${fullName}.${type.suffix}`),
    ]);
  }

  // mixed content in folder (ex: document)
  if (type.strategies?.adapter === 'mixedContent' && type.inFolder && !type.strategies.transformer) {
    return generateFolders({ fullName, type }, packageDirWithTypeDir).concat([
      join(packageDirWithTypeDir, `${fullName}${META_XML_SUFFIX}`),
      join(packageDirWithTypeDir, `${fullName}`),
    ]);
  }

  // mixed content not in folder (ex: staticResource,experienceBundle)
  if (type.strategies?.adapter === 'mixedContent' && !type.inFolder) {
    return [
      join(
        packageDirWithTypeDir,
        // registry doesn't have a suffix for EB (it comes down inside the mdapi response)
        `${fullName}.${type.strategies?.transformer === 'staticResource' ? type.suffix : 'site'}${META_XML_SUFFIX}`
      ),
      join(packageDirWithTypeDir, `${fullName}`),
    ];
  }

  // lwc, aura, waveTemplate
  if (type.strategies?.adapter === 'bundle') {
    const mappings = new Map<string, string>([
      ['WaveTemplateBundle', join(packageDirWithTypeDir, `${fullName}${sep}template-info.json`)],
      ['LightningComponentBundle', join(packageDirWithTypeDir, `${fullName}${sep}${fullName}.js${META_XML_SUFFIX}`)],
      ['AuraDefinitionBundle', join(packageDirWithTypeDir, `${fullName}${sep}${fullName}.cmp${META_XML_SUFFIX}`)],
    ]);

    if (!mappings.has(type.name)) {
      throw new Error(`Unsupported Bundle Type: ${type.name}`);
    }
    return [mappings.get(type.name)];
  }

  throw new Error(`type not supported for filepath generation: ${type.name}`);
};

const generateFolders = ({ fullName, type }: MetadataComponent, packageDirWithTypeDir: string): string[] => {
  // create a folder for each part of the filename between the directory name and the fullname
  const splits = fullName.split('/');
  return splits
    .slice(0, splits.length - 1) // the last one is not a folder
    .map((value, index, originalArray) =>
      join(
        packageDirWithTypeDir,
        `${originalArray.slice(0, index + 1).join(sep)}.${
          registryAccess.getTypeByName(type.folderType).suffix
        }${META_XML_SUFFIX}`
      )
    );
};

const getDecomposedChildType = ({ fullName, type }: MetadataComponent, packageDir?: string): string[] => {
  const topLevelType = registryAccess.findType((t) => t.children && Object.keys(t.children.types).includes(type.id));
  const topLevelTypeDir = packageDir ? join(packageDir, topLevelType.directoryName) : topLevelType.directoryName;

  return [
    // parent
    join(
      topLevelTypeDir,
      `${fullName.split('.')[0]}${sep}${fullName.split('.')[0]}.${topLevelType.suffix}${META_XML_SUFFIX}`
    ),
    // child
    join(
      topLevelTypeDir,
      fullName.split('.')[0],
      type.directoryName,
      `${fullName.split('.')[1]}.${type.suffix}${META_XML_SUFFIX}`
    ),
  ];
};
