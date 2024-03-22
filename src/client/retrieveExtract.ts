/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as path from 'node:path';
import { Logger } from '@salesforce/core';
import { isString } from '@salesforce/ts-types';
import * as fs from 'graceful-fs';
import { ConvertOutputConfig } from '../convert/types';
import { MetadataConverter } from '../convert/metadataConverter';
import { ComponentSet } from '../collections/componentSet';
import { ZipTreeContainer } from '../resolve/treeContainers';
import { SourceComponent } from '../resolve/sourceComponent';
import { ComponentStatus, FileResponse, FileResponseSuccess, PackageOption, PackageOptions } from './types';
import { MetadataApiRetrieveOptions } from './types';
import {
  PartialDeleteComp,
  supportsPartialDeleteAndHasContent,
  supportsPartialDeleteAndIsInMap,
  supportsPartialDeleteAndHasZipContent,
  pathOrSomeChildIsIgnored,
  deleteFilePath,
} from './metadataApiRetrieve';

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
export const handlePartialDeleteMerges = ({
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
