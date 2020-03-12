import {
  SourceAdapter,
  MetadataType,
  SourcePath,
  MetadataComponent
} from '../types';
import { parseMetadataXml } from '../util';
import { basename, dirname } from 'path';
import { RegistryAccess } from '../registry';

/**
 * The default source adapter.
 *
 * __Type Varients__: Simple types with no additional content.
 *
 * __Examples__: Layouts, PermissionSets, FlexiPages
 *
 * Unless there's a particular reason, most adapters will extend this one. It handles
 * shared functionality amongst the other adapters.
 */
export class BaseSourceAdapter implements SourceAdapter {
  protected type: MetadataType;

  constructor(type: MetadataType) {
    this.type = type;
  }

  /**
   * Get the MetadataComponent representation from a file path.
   *
   * At the time of writing, Typescript does not have a `final` keyword so
   * nothing is stopping you from overriding this method. It's best if you don't
   * because this handles shared functionality across adapters. If you must,
   * create a new implementation of SourceAdapter.
   *
   * @param fsPath File path for a piece of metadata
   */
  public getComponent(fsPath: SourcePath): MetadataComponent {
    const registry = new RegistryAccess();
    let metaXmlPath = fsPath;
    let isMetaXml = true;
    let parsedMetaXml = parseMetadataXml(fsPath);

    // If the path is not a metadata xml, or the metadata xml is not in the root
    // of the type directory, differ fetching the file to the child adapter
    const rootTypePath = dirname(this.type.inFolder ? dirname(fsPath) : fsPath);
    const inRootTypeFolder = basename(rootTypePath) === this.type.directoryName;
    if (!parsedMetaXml || !inRootTypeFolder) {
      metaXmlPath = this.getMetadataXmlPath(fsPath);
      if (!metaXmlPath) {
        throw new Error('missing metadata xml file');
      }
      parsedMetaXml = parseMetadataXml(metaXmlPath);
      isMetaXml = false;
    }

    const component: MetadataComponent = {
      fullName: parsedMetaXml.fullName,
      type: this.type,
      metaXml: metaXmlPath,
      sources: this.getSourcePaths(fsPath, isMetaXml)
    };

    if (this.type.inFolder) {
      component.fullName = `${basename(dirname(component.metaXml))}/${
        component.fullName
      }`;
    }

    return component;
  }

  protected getMetadataXmlPath(
    pathToSource: SourcePath
  ): SourcePath | undefined {
    return undefined;
  }

  protected getSourcePaths(
    fsPath: SourcePath,
    isMetaXml: boolean
  ): SourcePath[] {
    return [];
  }
}
