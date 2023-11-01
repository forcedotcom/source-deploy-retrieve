/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { join, sep, basename } from 'node:path';
import { Messages } from '@salesforce/core';
import { isPlainObject } from '@salesforce/ts-types';
import { MetadataComponent } from '../resolve/types';
import { META_XML_SUFFIX } from '../common/constants';
import { RegistryAccess } from '../registry/registryAccess';
import { registry } from '..';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/source-deploy-retrieve', 'sdr');

const registryAccess = new RegistryAccess();

/**
 * Provided a metadata fullName and type pair, return an array of file paths that should
 * be expected based on the type's definition in the metadata registry.
 *
 * This won't give all the filenames for decomposed types (that would require retrieving
 * the actual parent xml) but should provide enough of the filePath to figure out if the
 * forceignore would ignore it.
 *
 * Example:
 * `const type = new RegistryAccess().getTypeByName('ApexClass');`
 * `filePathsFromMetadataComponent({ fullName: 'MyClass', type }, 'myPackageDir');`
 * returns:
 * `['myPackageDir/classes/MyClass.cls', 'myPackageDir/classes/MyClass.cls-meta.xml']`
 *
 * @param param a MetadataComponent (type/name pair) for which to generate file paths
 * @param packageDir optional package directory to apply to the file paths
 * @returns array of file paths
 */
// eslint-disable-next-line complexity
export const filePathsFromMetadataComponent = (
  { fullName, type }: MetadataComponent,
  packageDir?: string
): string[] => {
  const packageDirWithTypeDir = packageDir ? join(packageDir, type.directoryName) : type.directoryName;

  if (type.strategies?.adapter === 'digitalExperience') {
    // child MD Type, the metafile is a JSON, not an XML
    if (type.id === 'digitalexperience') {
      // metafile name = metaFileSuffix for DigitalExperience.
      return [
        join(
          packageDirWithTypeDir,
          `${fullName.split('.')[0]}${sep}${fullName.split('.')[1]}${sep}${type.metaFileSuffix}`
        ),
      ];
    }

    // parent MD Type
    if (type.id === 'digitalexperiencebundle') {
      return [join(packageDirWithTypeDir, `${fullName}${sep}${basename(fullName)}.${type.suffix}${META_XML_SUFFIX}`)];
    }
  }

  if (type.strategies?.adapter === 'decomposed') {
    return [join(packageDirWithTypeDir, `${fullName}${sep}${fullName}.${type.suffix}${META_XML_SUFFIX}`)];
  }

  // this needs to be done before the other types because of potential overlaps
  if (!type.children && Object.keys(registry.childTypes).includes(type.id)) {
    return getDecomposedChildType({ fullName, type }, packageDir);
  }

  // Non-decomposed parents (i.e., any type that defines children and not a decomposed transformer)
  if (type.children) {
    return [join(packageDirWithTypeDir, `${fullName}.${type.suffix}${META_XML_SUFFIX}`)];
  }

  // basic metadata (with or without folders)
  if (!type.children && !type.strategies) {
    return (type.inFolder ?? type.folderType ? generateFolders({ fullName, type }, packageDirWithTypeDir) : []).concat([
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

  // lwc, aura, waveTemplate, experiencePropertyType
  if (type.strategies?.adapter === 'bundle') {
    const mappings = new Map<string, string>([
      ['ExperiencePropertyTypeBundle', join(packageDirWithTypeDir, `${fullName}${sep}schema.json`)],
      ['WaveTemplateBundle', join(packageDirWithTypeDir, `${fullName}${sep}template-info.json`)],
      ['LightningComponentBundle', join(packageDirWithTypeDir, `${fullName}${sep}${fullName}.js${META_XML_SUFFIX}`)],
      ['AuraDefinitionBundle', join(packageDirWithTypeDir, `${fullName}${sep}${fullName}.cmp${META_XML_SUFFIX}`)],
    ]);
    const matched = mappings.get(type.name);
    if (!matched) {
      throw messages.createError('unsupportedBundleType', [type.name]);
    }
    return [matched];
  }

  throw messages.createError('filePathGeneratorNoTypeSupport', [type.name]);
};

const generateFolders = ({ fullName, type }: MetadataComponent, packageDirWithTypeDir: string): string[] => {
  const folderType = type.folderType;
  if (!folderType) {
    throw messages.createError('missingFolderType', [type.name]);
  }
  // create a folder for each part of the filename between the directory name and the fullname
  const splits = fullName.split('/');
  return splits
    .slice(0, splits.length - 1) // the last one is not a folder
    .map((value, index, originalArray) =>
      join(
        packageDirWithTypeDir,
        `${originalArray.slice(0, index + 1).join(sep)}.${
          registryAccess.getTypeByName(folderType).suffix
        }${META_XML_SUFFIX}`
      )
    );
};

const getDecomposedChildType = ({ fullName, type }: MetadataComponent, packageDir?: string): string[] => {
  const topLevelType = registryAccess.findType(
    (t) => isPlainObject(t.children) && Object.keys(t.children.types).includes(type.id)
  );
  if (!topLevelType) {
    throw messages.createError('noParent', [fullName, type.name]);
  }
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
