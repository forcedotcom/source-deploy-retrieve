/*
 * Copyright 2025, Salesforce, Inc.
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
import * as path from 'node:path';
import { Logger } from '@salesforce/core/logger';
import { isString } from '@salesforce/ts-types';
import fs from 'graceful-fs';
import { ConvertOutputConfig } from '../convert/types';
import { MetadataConverter } from '../convert/metadataConverter';
import { ComponentSet } from '../collections/componentSet';
import { ZipTreeContainer } from '../resolve/treeContainers';
import { SourceComponent } from '../resolve/sourceComponent';
import { fnJoin } from '../utils/path';
import { ComponentStatus, FileResponse, FileResponseSuccess, PackageOption, PackageOptions } from './types';
import { MetadataApiRetrieveOptions } from './types';

export const extract = async ({
  zip,
  options,
  logger,
  mainComponents,
}: {
  zip: Buffer;
  options: MetadataApiRetrieveOptions;
  logger: Logger;
  mainComponents?: ComponentSet;
}): Promise<{ componentSet: ComponentSet; partialDeleteFileResponses: FileResponse[] }> => {
  const components: SourceComponent[] = [];
  const { merge, output, registry } = options;
  const converter = new MetadataConverter(registry);
  const tree = await ZipTreeContainer.create(zip);

  const partialDeleteFileResponses = [];

  const packages = [
    { zipTreeLocation: 'unpackaged', outputDir: output },
    ...getPackageOptions(options.packageOptions).map(({ name, outputDir }) => ({
      zipTreeLocation: name,
      outputDir,
    })),
  ];

  for (const pkg of packages) {
    const outputConfig: ConvertOutputConfig = merge
      ? {
          type: 'merge',
          mergeWith: mainComponents?.getSourceComponents() ?? [],
          defaultDirectory: pkg.outputDir,
          forceIgnoredPaths: mainComponents?.forceIgnoredPaths ?? new Set<string>(),
        }
      : {
          type: 'directory',
          outputDirectory: pkg.outputDir,
        };
    const retrievedComponents = ComponentSet.fromSource({
      fsPaths: [pkg.zipTreeLocation],
      registry,
      tree,
    })
      .getSourceComponents()
      .toArray();
    if (merge) {
      partialDeleteFileResponses.push(
        ...handlePartialDeleteMerges({ retrievedComponents, tree, mainComponents, logger })
      );
    }

    // this is intentional sequential
    // eslint-disable-next-line no-await-in-loop
    const convertResult = await converter.convert(retrievedComponents, 'source', outputConfig);
    components.push(...(convertResult?.converted ?? []));
    // additional partialDelete logic for decomposed types are handled in the transformer
    partialDeleteFileResponses.push(...(convertResult?.deleted ?? []));
  }
  return { componentSet: new ComponentSet(components, registry), partialDeleteFileResponses };
};

export const getPackageOptions = (packageOptions?: PackageOptions): Array<Required<PackageOption>> =>
  (packageOptions ?? []).map((po: string | PackageOption) =>
    isString(po) ? { name: po, outputDir: po } : { name: po.name, outputDir: po.outputDir ?? po.name }
  );

// Some bundle-like components can be partially deleted in the org, then retrieved. When this
// happens, the deleted files need to be deleted on the file system and added to the FileResponses
// that are returned by `RetrieveResult.getFileResponses()` for accuracy. The component types that
// support this behavior are defined in the metadata registry with `"supportsPartialDelete": true`.
// However, not all types can be partially deleted in the org. Currently this only applies to
// DigitalExperienceBundle and ExperienceBundle.
// side effect: deletes files
const handlePartialDeleteMerges = ({
  mainComponents,
  retrievedComponents,
  tree,
  logger,
}: {
  mainComponents?: ComponentSet;
  retrievedComponents: SourceComponent[];
  tree: ZipTreeContainer;
  logger: Logger;
}): FileResponse[] => {
  // Find all merge (local) components that support partial delete.
  const partialDeleteComponents = new Map<string, PartialDeleteComp>(
    (mainComponents?.getSourceComponents().toArray() ?? [])
      .filter(supportsPartialDeleteAndHasContent)
      .map((comp) => [comp.fullName, { contentPath: comp.content, contentList: fs.readdirSync(comp.content) }])
  );

  // Compare the contents of the retrieved components that support partial delete with the
  // matching merge components. If the merge components have files that the retrieved components
  // don't, delete the merge component and add all locally deleted files to the partial delete list
  // so that they are added to the `FileResponses` as deletes.
  return partialDeleteComponents.size === 0
    ? [] // If no partial delete components were in the mergeWith ComponentSet, no need to continue.
    : retrievedComponents
        .filter(supportsPartialDeleteAndIsInMap(partialDeleteComponents))
        .filter((comp) => partialDeleteComponents.get(comp.fullName)?.contentPath)
        .filter(supportsPartialDeleteAndHasZipContent(tree))
        .flatMap((comp) => {
          // asserted to be defined by the filter above
          const matchingLocalComp = partialDeleteComponents.get(comp.fullName)!;
          const remoteContentList = new Set(tree.readDirectory(comp.content));

          return matchingLocalComp.contentList
            .filter((fileName) => !remoteContentList.has(fileName))
            .filter((fileName) => !pathOrSomeChildIsIgnored(logger)(comp)(matchingLocalComp)(fileName))
            .map(
              (fileName): FileResponseSuccess => ({
                fullName: comp.fullName,
                type: comp.type.name,
                state: ComponentStatus.Deleted,
                filePath: path.join(matchingLocalComp.contentPath, fileName),
              })
            )
            .map(deleteFilePath(logger));
        });
};

const supportsPartialDeleteAndHasContent = (comp: SourceComponent): comp is SourceComponent & { content: string } =>
  supportsPartialDelete(comp) && typeof comp.content === 'string' && fs.statSync(comp.content).isDirectory();

const supportsPartialDeleteAndHasZipContent =
  (tree: ZipTreeContainer) =>
  (comp: SourceComponent): comp is SourceComponent & { content: string } =>
    supportsPartialDelete(comp) && typeof comp.content === 'string' && tree.isDirectory(comp.content);

const supportsPartialDeleteAndIsInMap =
  (partialDeleteComponents: Map<string, PartialDeleteComp>) =>
  (comp: SourceComponent): boolean =>
    supportsPartialDelete(comp) && partialDeleteComponents.has(comp.fullName);

const supportsPartialDelete = (comp: SourceComponent): boolean => comp.type.supportsPartialDelete === true;

type PartialDeleteComp = {
  contentPath: string;
  contentList: string[];
};

// If fileName is forceignored it is not counted as a diff. If fileName is a directory
// we have to read the contents to check forceignore status or we might get a false
// negative with `denies()` due to how the ignore library works.
const pathOrSomeChildIsIgnored =
  (logger: Logger) =>
  (component: SourceComponent) =>
  (localComp: PartialDeleteComp) =>
  (fileName: string): boolean => {
    const fileNameFullPath = path.join(localComp.contentPath, fileName);
    return fs.statSync(fileNameFullPath).isDirectory()
      ? fs.readdirSync(fileNameFullPath).map(fnJoin(fileNameFullPath)).some(isForceIgnored(logger)(component))
      : isForceIgnored(logger)(component)(fileNameFullPath);
  };

const isForceIgnored =
  (logger: Logger) =>
  (comp: SourceComponent) =>
  (filePath: string): boolean => {
    const ignored = comp.getForceIgnore().denies(filePath);
    if (ignored) {
      logger.debug(`Local component has ${filePath} while remote does not, but it is forceignored so ignoring.`);
    }
    return ignored;
  };

const deleteFilePath =
  (logger: Logger) =>
  (fr: FileResponseSuccess): FileResponseSuccess => {
    if (fr.filePath) {
      logger.debug(
        `Local component (${fr.fullName}) contains ${fr.filePath} while remote component does not. This file is being removed.`
      );
      fs.rmSync(fr.filePath, { recursive: true, force: true });
    }

    return fr;
  };
