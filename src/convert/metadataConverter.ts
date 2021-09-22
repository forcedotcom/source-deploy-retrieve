/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  ConvertOutputConfig,
  ConvertResult,
  DirectoryConfig,
  SfdxFileFormat,
  ZipConfig,
} from './types';
import { SourceComponent } from '../resolve';
import { promises } from 'fs';
import { dirname, join, normalize } from 'path';
import { ensureDirectoryExists } from '../utils/fileSystemHandler';
import {
  ComponentConverter,
  ComponentReader,
  ComponentWriter,
  pipeline,
  StandardWriter,
  ZipWriter,
} from './streams';
import { ConversionError, LibraryError } from '../errors';
import { SourcePath } from '../common';
import { ComponentSet, DestructiveChangesType } from '../collections';
import { RegistryAccess } from '../registry';

export class MetadataConverter {
  public static readonly PACKAGE_XML_FILE = 'package.xml';
  public static readonly DESTRUCTIVE_CHANGES_POST_XML_FILE = 'destructiveChangesPost.xml';
  public static readonly DESTRUCTIVE_CHANGES_PRE_XML_FILE = 'destructiveChangesPre.xml';
  public static readonly DEFAULT_PACKAGE_PREFIX = 'metadataPackage';

  private registry: RegistryAccess;

  constructor(registry = new RegistryAccess()) {
    this.registry = registry;
  }

  /**
   * Convert metadata components to another SFDX file format.
   *
   * @param components Components to convert
   * @param targetFormat Format to convert the component files to
   * @param output Configuration for outputting the converted files
   */
  public async convert(
    components: Iterable<SourceComponent>,
    targetFormat: SfdxFileFormat,
    output: ConvertOutputConfig
  ): Promise<ConvertResult>;

  /**
   * Convert metadata components within a `ComponentSet` to another SFDX file format.
   *
   * @param componentSet ComponentSet to convert
   * @param targetFormat Format to convert the component files to
   * @param output Configuration for outputting the converted files
   */
  public async convert(
    componentSet: ComponentSet,
    targetFormat: SfdxFileFormat,
    output: ConvertOutputConfig
  ): Promise<ConvertResult>;

  public async convert(
    comps: ComponentSet | Iterable<SourceComponent>,
    targetFormat: SfdxFileFormat,
    output: ConvertOutputConfig
  ): Promise<ConvertResult> {
    try {
      let cs: ComponentSet;
      let components: Iterable<SourceComponent>;
      if (comps instanceof ComponentSet) {
        cs = comps;
        components = Array.from(comps.getSourceComponents());
      } else {
        cs = new ComponentSet(comps, this.registry);
        components = comps;
      }
      let manifestContents;
      const isSource = targetFormat === 'source';
      const tasks = [];

      let writer: ComponentWriter;
      let mergeSet: ComponentSet;
      let packagePath: SourcePath;
      let defaultDirectory: SourcePath;

      switch (output.type) {
        case 'directory':
          if (output.packageName) {
            cs.fullName = output.packageName;
          }
          manifestContents = cs.getPackageXml();
          packagePath = this.getPackagePath(output);
          defaultDirectory = packagePath;
          writer = new StandardWriter(packagePath);
          if (!isSource) {
            const manifestPath = join(packagePath, MetadataConverter.PACKAGE_XML_FILE);
            tasks.push(promises.writeFile(manifestPath, manifestContents));
            // For deploying destructive changes
            const destructiveChangesTypes = cs.getTypesOfDestructiveChanges();
            if (destructiveChangesTypes) {
              // for each of the destructive changes in the component set, convert and write the correct metadata
              // to each manifest
              destructiveChangesTypes.map((destructiveChangesType) => {
                const file = this.convertTypeToManifest(destructiveChangesType);
                const destructiveManifestContents = cs.getPackageXml(4, destructiveChangesType);
                const destructiveManifestPath = join(packagePath, file);
                tasks.push(
                  promises.writeFile(destructiveManifestPath, destructiveManifestContents)
                );
              });
            }
          }
          break;
        case 'zip':
          if (output.packageName) {
            cs.fullName = output.packageName;
          }
          manifestContents = cs.getPackageXml();
          packagePath = this.getPackagePath(output);
          defaultDirectory = packagePath;
          writer = new ZipWriter(packagePath);
          if (!isSource) {
            (writer as ZipWriter).addToZip(manifestContents, MetadataConverter.PACKAGE_XML_FILE);
            // For deploying destructive changes
            const destructiveChangesTypes = cs.getTypesOfDestructiveChanges();
            if (destructiveChangesTypes.length) {
              // for each of the destructive changes in the component set, convert and write the correct metadata
              // to each manifest
              destructiveChangesTypes.map((destructiveChangeType) => {
                const file = this.convertTypeToManifest(destructiveChangeType);
                const destructiveManifestContents = cs.getPackageXml(4, destructiveChangeType);
                (writer as ZipWriter).addToZip(destructiveManifestContents, file);
              });
            }
          }
          break;
        case 'merge':
          if (!isSource) {
            throw new LibraryError('error_merge_metadata_target_unsupported');
          }
          defaultDirectory = output.defaultDirectory;
          mergeSet = new ComponentSet();
          // since child components are composed in metadata format, we need to merge using the parent
          for (const component of output.mergeWith) {
            mergeSet.add(component.parent ?? component);
          }
          writer = new StandardWriter(output.defaultDirectory);
          writer.forceIgnoredPaths = output.forceIgnoredPaths;
          break;
      }

      const conversionPipeline = pipeline(
        new ComponentReader(components),
        new ComponentConverter(targetFormat, this.registry, mergeSet, defaultDirectory),
        writer
      );
      tasks.push(conversionPipeline);
      await Promise.all(tasks);

      const result: ConvertResult = { packagePath };
      if (output.type === 'zip' && !packagePath) {
        result.zipBuffer = (writer as ZipWriter).buffer;
      } else if (output.type !== 'zip') {
        result.converted = (writer as StandardWriter).converted;
      }
      return result;
    } catch (e) {
      throw new ConversionError(e);
    }
  }

  private getPackagePath(outputConfig: DirectoryConfig | ZipConfig): SourcePath | undefined {
    let packagePath: SourcePath;
    const { genUniqueDir = true, outputDirectory, packageName, type } = outputConfig;
    if (outputDirectory) {
      if (packageName) {
        packagePath = join(outputDirectory, packageName);
      } else {
        if (genUniqueDir) {
          packagePath = join(
            outputDirectory,
            `${MetadataConverter.DEFAULT_PACKAGE_PREFIX}_${Date.now()}`
          );
        } else {
          packagePath = normalize(outputDirectory);
        }
      }

      if (type === 'zip') {
        packagePath += '.zip';
        ensureDirectoryExists(dirname(packagePath));
      } else {
        ensureDirectoryExists(packagePath);
      }
    }
    return packagePath;
  }

  private convertTypeToManifest(manifestFileName: DestructiveChangesType): string {
    if (manifestFileName === DestructiveChangesType.POST) {
      return MetadataConverter.DESTRUCTIVE_CHANGES_POST_XML_FILE;
    } else if (manifestFileName === DestructiveChangesType.PRE) {
      return MetadataConverter.DESTRUCTIVE_CHANGES_PRE_XML_FILE;
    }
    return MetadataConverter.PACKAGE_XML_FILE;
  }
}
