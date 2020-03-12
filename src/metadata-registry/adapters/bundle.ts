import {
  SourceAdapter,
  MetadataType,
  SourcePath,
  MetadataComponent,
  MetadataXml
} from '../types';
import { RegistryAccess } from '../registry';
import { sep, join, dirname } from 'path';
import { readdirSync, lstatSync } from 'fs';
import { parseMetadataXml, walk } from '../util';
import { META_XML_SUFFIX } from '../constants';
import { BaseSourceAdapter } from './base';
import { MixedContent } from './anyContent';

export class Bundle extends MixedContent {
  protected getMetadataXmlPath(pathToSource: SourcePath): SourcePath {
    const bundleRootPath = this.getPathToContent(pathToSource);
    const xmlFileName = readdirSync(bundleRootPath).find(
      f => !!parseMetadataXml(join(bundleRootPath, f))
    );
    if (xmlFileName) {
      return join(bundleRootPath, xmlFileName);
    }
  }
}
