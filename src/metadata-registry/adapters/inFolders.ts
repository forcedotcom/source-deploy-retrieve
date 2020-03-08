import { Simple } from './simple';
import { SourcePath, MetadataComponent, MetadataType } from '../types';
import { basename, join, parse } from 'path';
import { readdirSync } from 'fs';
import { parseMetadataXml } from '../util';
import { META_XML_SUFFIX } from '../constants';

export class InFolders extends Simple {
  public getComponent(
    type: MetadataType,
    fsPath: SourcePath
  ): MetadataComponent {
    const parsedPath = parse(fsPath);
    const parsedMetaXml = parseMetadataXml(fsPath);
    // FIX: guarantee that the name is up until the first dot
    const name = parsedPath.name.substring(0, parsedPath.name.indexOf('.'));

    let component: MetadataComponent;
    if (type.suffix && parsedMetaXml) {
      // if there's a suffix, just utilize the Simple adapter and fix the fullName
      component = super.getComponent(type, fsPath);
      component.fullName = `${basename(parsedPath.dir)}/${component.fullName}`;
    } else if (parsedMetaXml) {
      // Need to find the source file
      const content = readdirSync(parsedPath.dir).find(
        f => f.startsWith(name) && !f.endsWith(META_XML_SUFFIX)
      );
      component = {
        fullName: `${basename(parsedPath.dir)}/${parsedMetaXml.fullName}`,
        type,
        metaXml: fsPath,
        sources: [join(parsedPath.dir, content)]
      };
    } else {
      // need to find the -meta.xml file
      const metaXml = readdirSync(parsedPath.dir).find(
        f => f.startsWith(name) && f.endsWith(META_XML_SUFFIX)
      );
      component = {
        fullName: `${basename(parsedPath.dir)}/${metaXml.split('.')[0]}`,
        type,
        metaXml: join(parsedPath.dir, metaXml),
        sources: [fsPath]
      };
    }

    return component;
  }
}
