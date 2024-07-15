/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { basename, dirname, sep } from 'node:path';
import { Messages, SfError } from '@salesforce/core';
import { ensureString } from '@salesforce/ts-types';
import { MetadataXml } from '../types';
import { parseMetadataXml, parseNestedFullName } from '../../utils/path';
import { ForceIgnore } from '../forceIgnore';
import { TreeContainer } from '../treeContainers';
import { SourceComponent } from '../sourceComponent';
import { SourcePath } from '../../common/types';
import { MetadataType } from '../../registry/types';
import { RegistryAccess, typeAllowsMetadataWithContent } from '../../registry/registryAccess';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/source-deploy-retrieve', 'sdr');

export type AdapterContext = {
  registry: RegistryAccess;
  forceIgnore?: ForceIgnore;
  tree: TreeContainer;
  isResolvingSource?: boolean;
};

/**
 * If the path given to `getComponent` is the root metadata xml file for a component,
 * parse the name and return it. This is an optimization to not make a child adapter do
 * anymore work to find it.
 *
 * @param path File path of a metadata component
 */

export const parseAsRootMetadataXml =
  (type: MetadataType) =>
  (path: SourcePath): MetadataXml | undefined => {
    const metaXml = parseMetadataXml(path);
    if (metaXml) {
      let isRootMetadataXml = false;
      if (type.strictDirectoryName) {
        const parentPath = dirname(path);
        const typeDirName = basename(type.inFolder ? dirname(parentPath) : parentPath);
        const nameMatchesParent = basename(parentPath) === metaXml.fullName;
        const inTypeDir = typeDirName === type.directoryName;
        // if the parent folder name matches the fullName OR parent folder name is
        // metadata type's directory name, it's a root metadata xml.
        isRootMetadataXml = nameMatchesParent || inTypeDir;
      } else {
        isRootMetadataXml = true;
      }
      return isRootMetadataXml ? metaXml : undefined;
    }

    const folderMetadataXml = parseAsFolderMetadataXml(path);
    if (folderMetadataXml) {
      return folderMetadataXml;
    }

    if (!typeAllowsMetadataWithContent(type)) {
      return parseAsContentMetadataXml(type)(path);
    }
  };
/**
 * If the path given to `getComponent` serves as the sole definition (metadata and content)
 * for a component, parse the name and return it. This allows matching files in metadata
 * format such as:
 *
 * .../tabs/MyTab.tab
 *
 * @param path File path of a metadata component
 */
const parseAsContentMetadataXml =
  (type: MetadataType) =>
  (path: SourcePath): MetadataXml | undefined => {
    // InFolder metadata can be nested more than 1 level beneath its
    // associated directoryName.
    if (type.inFolder) {
      const fullName = parseNestedFullName(path, type.directoryName);
      if (fullName && type.suffix) {
        return { fullName, suffix: type.suffix, path };
      }
    }

    const parentPath = dirname(path);
    const parts = parentPath.split(sep);
    const typeFolderIndex = parts.lastIndexOf(type.directoryName);
    // nestedTypes (ex: territory2) have a folderType equal to their type but are themselves
    // in a folder per metadata item, with child folders for rules/territories
    const allowedIndex = type.folderType === type.id ? parts.length - 2 : parts.length - 1;

    if (typeFolderIndex !== allowedIndex) {
      return undefined;
    }

    const match = new RegExp(/(.+)\.(.+)/).exec(basename(path));
    if (match && type.suffix === match[2]) {
      return { fullName: match[1], suffix: match[2], path };
    }
  };

const parseAsFolderMetadataXml = (fsPath: SourcePath): MetadataXml | undefined => {
  const match = new RegExp(/(.+)-meta\.xml$/).exec(basename(fsPath));
  const parts = fsPath.split(sep);
  if (match && !match[1].includes('.') && parts.length > 1) {
    return { fullName: match[1], suffix: undefined, path: fsPath };
  }
};

// Given a MetadataXml, build a fullName from the path and type.
export const calculateName =
  (registry: RegistryAccess) =>
  (type: MetadataType) =>
  (rootMetadata: MetadataXml): string => {
    const { directoryName, inFolder, folderType, folderContentType } = type;

    // inFolder types (report, dashboard, emailTemplate, document) and their folder
    // container types (reportFolder, dashboardFolder, emailFolder, documentFolder)
    if (folderContentType ?? inFolder) {
      return ensureString(
        parseNestedFullName(rootMetadata.path, directoryName),
        `Unable to calculate fullName from component at path: ${rootMetadata.path} (${type.name})`
      );
    }

    // not using folders?  then name is fullname
    if (!folderType) {
      return rootMetadata.fullName;
    }
    const grandparentType = registry.getTypeByName(folderType);

    // type is nested inside another type (ex: Territory2Model).  So the names are modelName.ruleName or modelName.territoryName
    if (grandparentType.folderType && grandparentType.folderType !== type.id) {
      const splits = rootMetadata.path.split(sep);
      return `${splits[splits.indexOf(grandparentType.directoryName) + 1]}.${rootMetadata.fullName}`;
    }
    // this is the top level of nested types (ex: in a Territory2Model, the Territory2Model)
    if (grandparentType.folderType === type.id) {
      return rootMetadata.fullName;
    }
    throw messages.createError('cantGetName', [rootMetadata.path, type.name]);
  };

/**
 * Trim a path up until the root of a component's content. If the content is a file,
 * the given path will be returned back. If the content is a folder, the path to that
 * folder will be returned. Intended to be used exclusively for MixedContent types.
 *
 * @param path Path to trim
 * @param type MetadataType to determine content for
 */
export const trimPathToContent =
  (type: MetadataType) =>
  (path: SourcePath): SourcePath => {
    const pathParts = path.split(sep);
    const typeFolderIndex = pathParts.lastIndexOf(type.directoryName);
    const offset = type.inFolder ? 3 : 2;
    return pathParts.slice(0, typeFolderIndex + offset).join(sep);
  };

export type GetComponentInput = {
  type: MetadataType;
  path: SourcePath;
  /** either a MetadataXml OR a function that resolves to it using the type/path  */
  metadataXml?: MetadataXml | FindRootMetadata;
};

export type MaybeGetComponent = (context: AdapterContext) => (input: GetComponentInput) => SourceComponent | undefined;
export type GetComponent = (context: AdapterContext) => (input: GetComponentInput) => SourceComponent;
export type FindRootMetadata = (type: MetadataType, path: SourcePath) => MetadataXml | undefined;

/** requires a component, will definitely return one */
export type Populate = (
  context: AdapterContext
) => (type: MetadataType) => (trigger: SourcePath, component: SourceComponent) => SourceComponent;
export type MaybePopulate = (
  context: AdapterContext
) => (type: MetadataType) => (trigger: SourcePath, component?: SourceComponent) => SourceComponent | undefined;

export const getComponent: GetComponent =
  (context) =>
  ({ type, path, metadataXml: findRootMetadata = defaultFindRootMetadata }) => {
    // find rootMetadata
    const metadataXml = typeof findRootMetadata === 'function' ? findRootMetadata(type, path) : findRootMetadata;
    if (!metadataXml) {
      throw SfError.create({
        message: messages.getMessage('error_parsing_xml', [path, type.name]),
        name: 'MissingXml',
      });
    }
    if (context.forceIgnore?.denies(metadataXml.path)) {
      throw SfError.create({
        message: messages.getMessage('error_no_metadata_xml_ignore', [metadataXml.path, path]),
        name: 'UnexpectedForceIgnore',
      });
    }
    return new SourceComponent(
      {
        name: calculateName(context.registry)(type)(metadataXml),
        type,
        xml: metadataXml.path,
        parentType: type.folderType ? context.registry.getTypeByName(type.folderType) : undefined,
      },
      context.tree,
      context.forceIgnore
    );
  };

const defaultFindRootMetadata: FindRootMetadata = (type, path) => {
  const pathAsRoot = parseAsRootMetadataXml(type)(path);
  if (pathAsRoot) {
    return pathAsRoot;
  }

  return parseMetadataXml(path);
};
