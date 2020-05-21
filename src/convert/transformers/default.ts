import { MetadataTransformer } from '.';
import { MetadataComponent } from '../../types';
import { WriterFormat } from '../streams';
import { META_XML_SUFFIX } from '../../utils';
import { createReadStream } from 'fs';
import { sep } from 'path';

/**
 * The default metadata transformer.
 *
 * If a metadata type doesn't have a transformer assigned to it, this one is used
 * during the conversion process. It leaves the component's metadata xml and source
 * files as-is.
 */
export class DefaultTransformer implements MetadataTransformer {
  public toApiFormat(component: MetadataComponent): WriterFormat {
    const result: WriterFormat = { component, writeInfos: [] };
    const { directoryName } = component.type;
    let xmlDest = this.trimUntil(component.xml, directoryName);
    if (component.sources.length === 0) {
      xmlDest = xmlDest.slice(0, xmlDest.lastIndexOf(META_XML_SUFFIX));
    }
    result.writeInfos.push({
      source: createReadStream(component.xml),
      relativeDestination: xmlDest
    });
    // can this be improved?
    for (const source of component.sources) {
      result.writeInfos.push({
        source: createReadStream(source),
        relativeDestination: this.trimUntil(source, directoryName)
      });
    }
    return result;
  }

  public toSourceFormat(component: MetadataComponent): WriterFormat {
    // TODO: Improve error
    throw new Error('Source format conversion not yet supported');
  }

  protected trimUntil(path: string, name: string): string {
    const parts = path.split(sep);
    const index = parts.findIndex(part => name === part);
    if (index !== -1) {
      return parts.slice(index).join(sep);
    }
    return path;
  }
}
