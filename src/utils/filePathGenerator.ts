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

export const filePathsFromMetadataComponent = (
  { fullName, type }: MetadataComponent,
  packageDir?: string
): string[] => {
  const packageDirWithTypeDir = packageDir ? join(packageDir, type.directoryName) : type.directoryName;
  // the basic metadata file pattern
  if (!type.children && !type.strategies && !type.inFolder && !type.folderType) {
    return [join(packageDirWithTypeDir, `${fullName}.${type.suffix}${META_XML_SUFFIX}`)];
  }

  // basic metadata in folders
  if (!type.children && !type.strategies && (type.inFolder || type.folderType)) {
    return generateFolders({ fullName, type }, packageDirWithTypeDir).concat([
      join(packageDirWithTypeDir, `${fullName}.${type.suffix}${META_XML_SUFFIX}`),
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

  // matching content not in folders
  if (type.strategies?.adapter === 'matchingContentFile') {
    return (type.inFolder ? generateFolders({ fullName, type }, packageDirWithTypeDir) : []).concat([
      join(packageDirWithTypeDir, `${fullName}.${type.suffix}${META_XML_SUFFIX}`),
      join(packageDirWithTypeDir, `${fullName}.${type.suffix}`),
    ]);
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
};

const generateFolders = ({ fullName, type }: MetadataComponent, packageDirWithTypeDir: string): string[] => {
  const registryAccess = new RegistryAccess();

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
