import { MetadataComponent, MetadataTransformer, WriterFormat } from '../../types';
import { META_XML_SUFFIX } from '../../utils';
import { createReadStream } from 'fs';
import { sep } from 'path';
import { LibraryError } from '../../errors';

/**
 * The default metadata transformer.
 *
 * If a metadata type doesn't have a transformer assigned to it, this one is used
 * during the conversion process. It leaves the component's metadata xml and source
 * files as-is.
 */
export class DefaultTransformer implements MetadataTransformer {
  private component: MetadataComponent;

  constructor(component: MetadataComponent) {
    this.component = component;
  }

  public toMetadataFormat(): WriterFormat {
    const result: WriterFormat = { component: this.component, writeInfos: [] };
    const { directoryName } = this.component.type;
    let xmlDest = this.trimUntil(this.component.xml, directoryName);
    if (this.component.sources.length === 0) {
      xmlDest = xmlDest.slice(0, xmlDest.lastIndexOf(META_XML_SUFFIX));
    }
    result.writeInfos.push({
      source: createReadStream(this.component.xml),
      relativeDestination: xmlDest
    });
    for (const source of this.component.sources) {
      result.writeInfos.push({
        source: createReadStream(source),
        relativeDestination: this.trimUntil(source, directoryName)
      });
    }
    return result;
  }

  public toSourceFormat(): WriterFormat {
    throw new LibraryError('error_convert_not_implemented', ['source', this.component.type.name]);
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
