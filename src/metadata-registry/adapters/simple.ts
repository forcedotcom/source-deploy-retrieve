import { SourceAdapter, MetadataType, MetadataComponent } from '../types';
import { parseMetadataXml } from '../util';

export class Simple implements SourceAdapter {
  public getComponent(type: MetadataType, fsPath: string): MetadataComponent {
    const { fullName } = parseMetadataXml(fsPath);
    if (fullName) {
      return {
        fullName,
        type,
        metaXml: fsPath,
        sources: []
      };
    }
  }
}
