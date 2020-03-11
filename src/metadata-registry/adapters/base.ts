import {
  SourceAdapter,
  MetadataType,
  SourcePath,
  MetadataComponent
} from '../types';
import { parseMetadataXml } from '../util';
import { basename, dirname } from 'path';
import { RegistryAccess } from '../registry';

export class BaseSourceAdapter implements SourceAdapter {
  protected type: MetadataType;

  constructor(type: MetadataType) {
    this.type = type;
  }

  public readonly getComponent = (fsPath: SourcePath): MetadataComponent => {
    const registry = new RegistryAccess();
    let metaXmlPath = fsPath;
    let isMetaXml = true;
    let parsedMetaXml = parseMetadataXml(fsPath);

    if (!parsedMetaXml || parsedMetaXml.suffix !== this.type.suffix) {
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
  };

  protected getMetadataXmlPath(fsPath: SourcePath): SourcePath | undefined {
    return undefined;
  }

  protected getSourcePaths(
    fsPath: SourcePath,
    isMetaXml: boolean
  ): SourcePath[] {
    return [];
  }
}
