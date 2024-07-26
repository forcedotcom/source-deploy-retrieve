/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { dirname, sep, basename } from 'node:path';
import { Messages } from '@salesforce/core';
import { ensure } from '@salesforce/ts-types';
import { ensureString } from '@salesforce/ts-types';
import type { RegistryAccess } from '../../registry/registryAccess';
import { MetadataType } from '../../registry/types';
import { META_XML_SUFFIX } from '../../common/constants';
import { SourcePath } from '../../common/types';
import { SourceComponent } from '../sourceComponent';
import { MetadataXml } from '../types';
import { baseName, parentName, parseMetadataXml } from '../../utils/path';
import { MaybeGetComponent, Populate, getComponent, parseAsRootMetadataXml } from './baseSourceAdapter';
import { populateMixedContent } from './mixedContentSourceAdapter';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/source-deploy-retrieve', 'sdr');
/**
 * Source Adapter for DigitalExperience metadata types. This metadata type is a bundled type of the format
 *
 * __Example Structure__:
 *
 *```text
 * site/
 * ├── foos/
 * |   ├── sfdc_cms__appPage/
 * |   |   ├── mainAppPage/
 * |   |   |  ├── _meta.json
 * |   |   |  ├── content.json
 * |   ├── sfdc_cms__view/
 * |   |   ├── view1/
 * |   |   |  ├── _meta.json
 * |   |   |  ├── content.json
 * |   |   |  ├── fr.json
 * |   |   |  ├── en.json
 * |   |   ├── view2/
 * |   |   |  ├── _meta.json
 * |   |   |  ├── content.json
 * |   |   |  ├── ar.json
 * |   |   ├── view3/
 * |   |   |  ├── _meta.json
 * |   |   |  ├── content.json
 * |   |   |  ├── mobile/
 * |   |   |  |   ├──mobile.json
 * |   |   |  ├── tablet/
 * |   |   |  |   ├──tablet.json
 * |   ├── foos.digitalExperience-meta.xml
 * content/
 * ├── bars/
 * |   ├── bars.digitalExperience-meta.xml
 * ```
 *
 * In the above structure the metadata xml file ending with "digitalExperience-meta.xml" belongs to DigitalExperienceBundle MD type.
 * The "_meta.json" files are child metadata files of DigitalExperienceBundle belonging to DigitalExperience MD type. The rest of the files in the
 * corresponding folder are the contents to the DigitalExperience metadata. So, incase of DigitalExperience the metadata file is a JSON file
 * and not an XML file
 */

export const getDigitalExperienceComponent: MaybeGetComponent =
  (context) =>
  ({ path, type }) => {
    // if it's an empty directory, don't include it (e.g., lwc/emptyLWC)
    if (context.tree.isEmptyDirectory(path)) return;
    const componentRoot = isBundleType(type) ? path : trimNonBundlePathToContentPath(path);
    const rootMeta = context.tree.find('metadataXml', basename(componentRoot), componentRoot);
    const rootMetaXml = rootMeta
      ? parseAsRootMetadataXml(type)(rootMeta)
      : ensure(parseMetadataXmlForDEB(context.registry)(type)(path));
    const sourceComponent = getComponent(context)({ type, path, metadataXml: rootMetaXml });
    return populate(context)(type)(path, sourceComponent);
  };

const parseMetadataXmlForDEB =
  (registry: RegistryAccess) =>
  (type: MetadataType) =>
  (path: SourcePath): MetadataXml | undefined => {
    const xml = parseMetadataXml(path);
    if (xml) {
      return {
        fullName: getBundleName(getBundleMetadataXmlPath(registry)(type)(path)),
        suffix: xml.suffix,
        path: xml.path,
      };
    }
  };

const getBundleName = (bundlePath: string): string => `${parentName(dirname(bundlePath))}/${parentName(bundlePath)}`;

const getBundleMetadataXmlPath =
  (registry: RegistryAccess) =>
  (type: MetadataType) =>
  (path: string): string => {
    if (isBundleType(type) && path.endsWith(META_XML_SUFFIX)) {
      // if this is the bundle type and it ends with -meta.xml, then this is the bundle metadata xml path
      return path;
    }
    const pathParts = path.split(sep);
    const typeFolderIndex = pathParts.lastIndexOf(type.directoryName);
    // 3 because we want 'digitalExperiences' directory, 'baseType' directory and 'bundleName' directory
    const basePath = pathParts.slice(0, typeFolderIndex + 3).join(sep);
    const bundleFileName = pathParts[typeFolderIndex + 2];
    const suffix = ensureString(isBundleType(type) ? type.suffix : registry.getParentType(type.id)?.suffix);
    return `${basePath}${sep}${bundleFileName}.${suffix}${META_XML_SUFFIX}`;
  };

const isBundleType = (type: MetadataType): boolean => type.id === 'digitalexperiencebundle';

const trimNonBundlePathToContentPath = (path: string): string => {
  const pathToContent = dirname(path);
  const parts = pathToContent.split(sep);
  /* Handle mobile or tablet variants.Eg- digitalExperiences/site/lwr11/sfdc_cms__view/home/mobile/mobile.json
     Go back to one level in that case
     Bundle hierarchy baseType/spaceApiName/contentType/contentApiName/variantFolders/file */
  const digitalExperiencesIndex = parts.indexOf('digitalExperiences');
  if (digitalExperiencesIndex > -1) {
    const depth = parts.length - digitalExperiencesIndex - 1;
    if (depth === digitalExperienceBundleWithVariantsDepth) {
      parts.pop();
      return parts.join(sep);
    }
  }
  return pathToContent;
};

const populate: Populate = (context) => (type) => (path, component) => {
  if (isBundleType(type) && component) {
    // for top level types we don't need to resolve parent
    return component;
  }
  const source = populateMixedContent(context)(type)(path, component);
  const parentType = context.registry.getParentType(type.id);
  // we expect source, parentType and content to be defined.
  if (!source || !parentType || !source.content) {
    throw messages.createError('error_failed_convert', [component?.fullName ?? type.name]);
  }
  const xml = getBundleMetadataXmlPath(context.registry)(type)(source.content);
  const parent = new SourceComponent(
    {
      name: getBundleName(xml),
      type: parentType,
      xml,
    },
    context.tree,
    context.forceIgnore
  );
  return new SourceComponent(
    {
      name: calculateNameFromPath(source.content),
      type,
      content: source.content,
      xml: source.xml,
      parent,
      parentType,
    },
    context.tree,
    context.forceIgnore
  );
};
/**
 * @param contentPath This hook is called only after trimPathToContent() is called. so this will always be a folder structure
 * @returns name of type/apiName format
 */
const calculateNameFromPath = (contentPath: string): string => `${parentName(contentPath)}/${baseName(contentPath)}`;

// Bundle hierarchy baseType/spaceApiName/contentType/contentApiName/variantFolders/file
const digitalExperienceBundleWithVariantsDepth = 5;
