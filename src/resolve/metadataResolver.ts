/*
 * Copyright 2026, Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { basename, dirname, sep } from 'node:path';
import { Lifecycle } from '@salesforce/core/lifecycle';
import { Messages } from '@salesforce/core/messages';
import { SfError } from '@salesforce/core/sfError';
import { Logger } from '@salesforce/core/logger';
import { extName, fnJoin, parentName, parseMetadataXml } from '../utils/path';
import { RegistryAccess } from '../registry/registryAccess';
import { MetadataType } from '../registry/types';
import { ComponentSet } from '../collections/componentSet';
import { META_XML_SUFFIX } from '../common/constants';
import { SourceAdapterFactory } from './adapters/sourceAdapterFactory';
import { ForceIgnore } from './forceIgnore';
import { SourceComponent } from './sourceComponent';
import { NodeFSTreeContainer, TreeContainer } from './treeContainers';
import { isWebAppBaseType } from './adapters/digitalExperienceSourceAdapter';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/source-deploy-retrieve', 'sdr');

/**
 * Resolver for metadata type and component objects.
 *
 * @internal
 */
export class MetadataResolver {
  public forceIgnoredPaths: Set<string>;
  private forceIgnore?: ForceIgnore;

  /**
   * @param registry Custom registry data
   * @param tree `TreeContainer` to traverse with
   * @param useFsForceIgnore false = use default forceignore entries, true = search and use forceignore in project
   */
  public constructor(
    private registry = new RegistryAccess(),
    private tree: TreeContainer = new NodeFSTreeContainer(),
    private useFsForceIgnore = true
  ) {
    this.forceIgnoredPaths = new Set<string>();
  }

  /**
   * Get the metadata component(s) from a file path.
   *
   * @param fsPath File path to metadata or directory
   * @param inclusiveFilter Set to filter which components are resolved
   */
  public getComponentsFromPath(fsPath: string, inclusiveFilter?: ComponentSet): SourceComponent[] {
    if (!this.tree.exists(fsPath)) {
      throw new SfError(messages.getMessage('error_path_not_found', [fsPath]), 'TypeInferenceError');
    }

    // use the default ignore if we aren't using a real one
    this.forceIgnore = this.useFsForceIgnore ? ForceIgnore.findAndCreate(fsPath) : new ForceIgnore();

    if (this.tree.isDirectory(fsPath) && !resolveDirectoryAsComponent(this.registry)(this.tree)(fsPath)) {
      return this.getComponentsFromPathRecursive(fsPath, inclusiveFilter);
    }

    const component = this.resolveComponent(fsPath, true);
    return component ? [component] : [];
  }

  private getComponentsFromPathRecursive(dir: string, inclusiveFilter?: ComponentSet): SourceComponent[] {
    const dirQueue: string[] = [];
    const components: SourceComponent[] = [];
    const ignore = new Set();

    // don't apply forceignore rules against dirs
    // `forceignore.denies` will pass a relative path to node-ignore, e.g.
    // `path/to/force-app` -> `force-app`, note that there's no trailing slash
    // so node-ignore will treat it as a file.
    if (!this.tree.isDirectory(dir) && this.forceIgnore?.denies(dir)) {
      return components;
    }

    for (const fsPath of this.tree
      .readDirectory(dir)
      .map(fnJoin(dir))
      // this method isn't truly recursive, we need to sort directories before files so we look as far down as possible
      // before finding the parent and returning only it - by sorting, we make it as recursive as possible
      .sort(this.sortDirsFirst)) {
      if (ignore.has(fsPath)) {
        continue;
      }

      if (this.tree.isDirectory(fsPath)) {
        if (resolveDirectoryAsComponent(this.registry)(this.tree)(fsPath)) {
          // Filter out empty directories to prevent deployment issues
          if (this.tree.readDirectory(fsPath).length === 0) {
            continue;
          }

          const component = this.resolveComponent(fsPath, true);
          if (component && (!inclusiveFilter || inclusiveFilter.has(component))) {
            components.push(component);
            ignore.add(component.xml);
          }
        } else {
          dirQueue.push(fsPath);
        }
      } else if (isMetadata(this.registry)(this.tree)(fsPath)) {
        const component = this.resolveComponent(fsPath, false);
        if (component) {
          if (!inclusiveFilter || inclusiveFilter.has(component)) {
            components.push(component);
            ignore.add(component.content);
          } else {
            for (const child of component.getChildren()) {
              if (inclusiveFilter.has(child)) {
                components.push(child);
              }
            }
          }
          // don't traverse further if not in a root type directory. performance optimization
          // for mixed content types and ensures we don't add duplicates of the component.
          const typeDir = basename(dirname(component.type.inFolder ? dirname(fsPath) : fsPath));
          if (component.type.strictDirectoryName && typeDir !== component.type.directoryName) {
            return components;
          }
        }
      }
    }

    return components.concat(dirQueue.flatMap((d) => this.getComponentsFromPathRecursive(d, inclusiveFilter)));
  }

  private sortDirsFirst = (a: string, b: string): number => {
    if (this.tree.isDirectory(a) && this.tree.isDirectory(b)) {
      return 0;
    } else if (this.tree.isDirectory(a) && !this.tree.isDirectory(b)) {
      return -1;
    } else {
      return 1;
    }
  };
  private resolveComponent(fsPath: string, isResolvingSource: boolean): SourceComponent | undefined {
    if (this.forceIgnore?.denies(fsPath)) {
      // don't resolve the component if the path is denied
      this.forceIgnoredPaths.add(fsPath);
      return;
    }
    const type = resolveType(this.registry)(this.tree)(fsPath);
    if (type) {
      const adapter = new SourceAdapterFactory(this.registry, this.tree).getAdapter(type, this.forceIgnore);
      // short circuit the component resolution unless this is a resolve for a
      // source path or allowed content-only path, otherwise the adapter
      // knows how to handle it
      const shouldResolve =
        isResolvingSource ||
        parseAsRootMetadataXml(fsPath) ||
        !parseAsContentMetadataXml(this.registry)(fsPath) ||
        !adapter.allowMetadataWithContent();
      return shouldResolve ? adapter.getComponent(fsPath, isResolvingSource) : undefined;
    }

    if (isProbablyPackageManifest(this.tree)(fsPath)) return undefined;

    void Lifecycle.getInstance().emitTelemetry({
      eventName: 'metadata_resolver_type_inference_error',
      library: 'SDR',
      function: 'resolveComponent',
      path: fsPath,
    });

    // The metadata type could not be inferred
    // Attempt to guess the type and throw an error with actions
    const actions = getSuggestionsForUnresolvedTypes(this.registry)(fsPath);

    throw new SfError(messages.getMessage('error_could_not_infer_type', [fsPath]), 'TypeInferenceError', actions);
  }
}

const isProbablyPackageManifest =
  (tree: TreeContainer) =>
  (fsPath: string): boolean => {
    // Perform some additional checks to see if this is a package manifest
    if (fsPath.endsWith('.xml') && !fsPath.endsWith(META_XML_SUFFIX)) {
      // If it is named the default package.xml, assume it is a package manifest
      if (fsPath.endsWith('package.xml')) return true;
      try {
        // If the file contains the string "<Package xmlns", it is a package manifest
        if (tree.readFileSync(fsPath).toString().includes('<Package xmlns')) return true;
      } catch (err) {
        const error = err as Error;
        if (error.message === 'Method not implemented') {
          // Currently readFileSync is not implemented for zipTreeContainer
          // Ignoring since this would have been ignored in the past
          Logger.childFromRoot('metadataResolver.isProbablyPackageManifest').warn(
            `Type could not be inferred for ${fsPath}. It is likely this is a package manifest. Skipping...`
          );
          return true;
        }
        return false;
      }
    }
    return false;
  };

/**
 * Whether or not a directory that represents a single component should be resolved as one,
 * or if it should be walked for additional components.
 *
 * If a type can be determined from a directory path, and the end part of the path isn't
 * the directoryName of the type itself, infer the path is part of a mixedContent component
 *
 * @param registry the registry to resolve a type against
 */
const resolveDirectoryAsComponent =
  (registry: RegistryAccess) =>
  (tree: TreeContainer) =>
  (dirPath: string): boolean => {
    // For web_app bundles, only the bundle directory itself should be resolved as a component
    // (e.g., digitalExperiences/web_app/WebApp), not subdirectories like src/, public/, etc.
    if (isWebAppBaseType(dirPath)) {
      const pathParts = dirPath.split(sep);
      const digitalExperiencesIndex = pathParts.indexOf('digitalExperiences');
      // The bundle directory is exactly 3 levels deep: digitalExperiences/web_app/bundleName
      return digitalExperiencesIndex !== -1 && pathParts.length === digitalExperiencesIndex + 3;
    }

    const type = resolveType(registry)(tree)(dirPath);
    if (type) {
      const { directoryName, inFolder } = type;
      const parts = dirPath.split(sep);
      const folderOffset = inFolder ? 2 : 1;
      const typeDirectoryIndex = parts.lastIndexOf(directoryName);
      if (
        typeDirectoryIndex === -1 ||
        parts.length - folderOffset <= typeDirectoryIndex ||
        // ex: /lwc/folder/lwc/cmp
        tree.readDirectory(dirPath).includes(type.directoryName) ||
        // types with children may want to resolve them individually
        type.children
      ) {
        return false;
      }
    } else {
      return false;
    }

    return true;
  };

const isMetadata =
  (registry: RegistryAccess) =>
  (tree: TreeContainer) =>
  (fsPath: string): boolean =>
    !!parseMetadataXml(fsPath) ||
    parseAsContentMetadataXml(registry)(fsPath) ||
    !!parseAsFolderMetadataXml(registry)(fsPath) ||
    !!parseAsMetadata(registry)(tree)(fsPath);
/**
 * Attempt to find similar types for types that could not be inferred
 * To be used after executing the resolveType() method
 *
 * @returns an array of suggestions
 * @param registry a metdata registry to resolve types against
 */
const getSuggestionsForUnresolvedTypes =
  (registry: RegistryAccess) =>
  (fsPath: string): string[] => {
    const parsedMetaXml = parseMetadataXml(fsPath);
    const metaSuffix = parsedMetaXml?.suffix;
    // Finds close matches for meta suffixes
    // Examples: https://regex101.com/r/vbRjwy/1
    const closeMetaSuffix = new RegExp(/.+\.([^.-]+)(?:-.*)?\.xml/).exec(basename(fsPath));

    let guesses;

    if (metaSuffix) {
      guesses = registry.guessTypeBySuffix(metaSuffix);
    } else if (!metaSuffix && closeMetaSuffix) {
      guesses = registry.guessTypeBySuffix(closeMetaSuffix[1]);
    } else {
      guesses = registry.guessTypeBySuffix(extName(fsPath));
    }

    // If guesses were found, format an array of strings to be passed to SfError's actions
    return guesses && guesses.length > 0
      ? [
          messages.getMessage('suggest_type_header', [basename(fsPath)]),
          ...guesses.map((guess) =>
            messages.getMessage('suggest_type_did_you_mean', [
              guess.suffixGuess,
              typeof metaSuffix === 'string' || closeMetaSuffix ? '-meta.xml' : '',
              guess.metadataTypeGuess.name,
            ])
          ),
          '', // A blank line makes this much easier to read (it doesn't seem to be possible to start a markdown message entry with a newline)
          messages.getMessage('suggest_type_more_suggestions'),
        ]
      : [];
  };

// Get the array of directoryNames for types that have folderContentType
const getFolderContentTypeDirNames = (registry: RegistryAccess): string[] =>
  registry.getFolderContentTypes().map((t) => t.directoryName);

/**
 * Identify metadata xml for a folder component:
 * .../email/TestFolder-meta.xml
 * .../reports/foo/bar-meta.xml
 *
 * Do not match this pattern:
 * .../tabs/TestFolder.tab-meta.xml
 */
const parseAsFolderMetadataXml =
  (registry: RegistryAccess) =>
  (fsPath: string): string | undefined => {
    let folderName: string | undefined;
    const match = new RegExp(/(.+)-meta\.xml/).exec(basename(fsPath));
    if (match && !match[1].includes('.')) {
      const parts = fsPath.split(sep);
      if (parts.length > 1) {
        const folderContentTypesDirs = getFolderContentTypeDirNames(registry);
        // check if the path contains a folder content name as a directory
        // e.g., `/reports/` and if it does return that folder name.
        folderContentTypesDirs.some((dirName) => {
          if (fsPath.includes(`${sep}${dirName}${sep}`)) {
            folderName = dirName;
          }
        });
      }
    }
    return folderName;
  };

const resolveType =
  (registry: RegistryAccess) =>
  (tree: TreeContainer) =>
  (fsPath: string): MetadataType | undefined => {
    if (isWebAppBaseType(fsPath)) {
      return registry.getTypeByName('DigitalExperienceBundle');
    }

    // attempt 1 - check if the file is part of a component that requires a strict type folder
    let resolvedType = resolveTypeFromStrictFolder(registry)(fsPath);

    // attempt 2 - check if it's a metadata xml file
    if (!resolvedType) {
      const parsedMetaXml = parseMetadataXml(fsPath);
      if (parsedMetaXml?.suffix) {
        resolvedType = registry.getTypeBySuffix(parsedMetaXml.suffix);
      }
    }

    // attempt 2.5 - test for a folder style xml file
    if (!resolvedType) {
      const metadataFolder = parseAsFolderMetadataXml(registry)(fsPath);
      if (metadataFolder) {
        // multiple matching directories may exist - folder components are not 'inFolder'
        resolvedType = registry.findType((type) => type.directoryName === metadataFolder && !type.inFolder);
      }
    }

    // attempt 3 - try treating the file extension name as a suffix
    if (!resolvedType) {
      resolvedType = registry.getTypeBySuffix(extName(fsPath));

      // Metadata types with `strictDirectoryName` should have been caught in "attempt 1".
      // If the metadata returned from this lookup has a `strictDirectoryName`, something is wrong.
      // It is likely that the metadata file is misspelled or has the wrong suffix.
      // A common occurrence is that a misspelled metadata file will fall back to
      // `EmailServicesFunction` because that is the default for the `.xml` suffix
      if (resolvedType?.strictDirectoryName === true) {
        resolvedType = undefined;
      }
    }

    // attempt 4 - try treating the content as metadata
    if (!resolvedType) {
      const metadata = parseAsMetadata(registry)(tree)(fsPath);
      if (metadata) {
        resolvedType = registry.getTypeByName(metadata);
      }
    }

    return resolvedType;
  };
/**
 * Any file with a registered suffix is potentially a content metadata file.
 *
 * @param registry a metadata registry to resolve types agsinst
 */
const parseAsContentMetadataXml =
  (registry: RegistryAccess) =>
  (fsPath: string): boolean => {
    const suffixType = registry.getTypeBySuffix(extName(fsPath));
    if (!suffixType) return false;

    const matchesSuffixType = fsPath.split(sep).includes(suffixType.directoryName);
    if (matchesSuffixType) return matchesSuffixType;

    // at this point, the suffixType is not a match, so check for strict folder types
    return !!resolveTypeFromStrictFolder(registry)(fsPath);
  };

/**
 * If this file should be considered as a metadata file then return the metadata type
 */
const parseAsMetadata =
  (registry: RegistryAccess) =>
  (tree: TreeContainer) =>
  (fsPath: string): string | undefined => {
    if (tree.isDirectory(fsPath)) {
      return;
    }
    return ['DigitalExperience', 'ExperiencePropertyTypeBundle', 'LightningTypeBundle', 'ContentTypeBundle']
      .map((type) => registry.getTypeByName(type))
      .find((type) => fsPath.split(sep).includes(type.directoryName))?.name;
  };

const resolveTypeFromStrictFolder =
  (registry: RegistryAccess) =>
  (fsPath: string): MetadataType | undefined => {
    const pathParts = fsPath.split(sep);
    // first, filter out types that don't appear in the path
    // then iterate using for/of to allow for early break
    return registry
      .getStrictFolderTypes()
      .filter(pathIncludesDirName(pathParts)) // the type's directory is in the path
      .filter(folderTypeFilter(fsPath))
      .find(
        (type) =>
          // any of the following options is considered a good match
          isMixedContentOrBundle(type) ||
          suffixMatches(type, fsPath) ||
          childSuffixMatches(type, fsPath) ||
          legacySuffixMatches(type, fsPath)
      );
  };

/** the type has children and the file suffix (in source format) matches a child type suffix of the type we think it is */
const childSuffixMatches = (type: MetadataType, fsPath: string): boolean =>
  Object.values(type.children?.types ?? {}).some(
    (childType) => suffixMatches(childType, fsPath) || legacySuffixMatches(childType, fsPath)
  );

/** the file suffix (in source or mdapi format) matches the type suffix we think it is */
const suffixMatches = (type: MetadataType, fsPath: string): boolean =>
  typeof type.suffix === 'string' &&
  (fsPath.endsWith(type.suffix) || fsPath.endsWith(appendMetaXmlSuffix(type.suffix)));

const legacySuffixMatches = (type: MetadataType, fsPath: string): boolean => {
  if (
    typeof type.legacySuffix === 'string' &&
    (fsPath.endsWith(type.legacySuffix) || fsPath.endsWith(appendMetaXmlSuffix(type.legacySuffix)))
  ) {
    void Lifecycle.getInstance().emitWarning(
      `The ${type.name} component at ${fsPath} uses the legacy suffix ${type.legacySuffix}. This suffix is deprecated and will be removed in a future release.`
    );
    return true;
  }
  return false;
};
const appendMetaXmlSuffix = (suffix: string): string => `${suffix}${META_XML_SUFFIX}`;

const isMixedContentOrBundle = (type: MetadataType): boolean =>
  typeof type.strategies?.adapter === 'string' &&
  ['mixedContent', 'bundle', 'webApplications'].includes(type.strategies.adapter);

/** types with folders only have folder components living at the top level.
 * if the fsPath is a folder component, let a future strategy deal with it
 */
const folderTypeFilter =
  (fsPath: string) =>
  (type: MetadataType): boolean =>
    !type.inFolder || parentName(fsPath) !== type.directoryName;

const pathIncludesDirName =
  (parts: string[]) =>
  (type: MetadataType): boolean =>
    parts.includes(type.directoryName);
/**
 * Any metadata xml file (-meta.xml) is potentially a root metadata file.
 *
 * @param fsPath File path of a potential metadata xml file
 */
const parseAsRootMetadataXml = (fsPath: string): boolean => Boolean(parseMetadataXml(fsPath));
