import { join } from 'path';
import { mockRegistry } from '../../mock/registry';
import { DefaultSourceAdapter } from '../../../src/metadata-registry/adapters/defaultSourceAdapter';
import { expect } from 'chai';
import { BaseSourceAdapter } from '../../../src/metadata-registry/adapters/baseSourceAdapter';
import { SourcePath, MetadataComponent } from '../../../src/types';

class TestChildAdapter extends BaseSourceAdapter {
  public static readonly xmlPath = join('path', 'to', 'dwaynes', 'a.dwayne-meta.xml');
  protected getRootMetadataXmlPath(): SourcePath {
    return TestChildAdapter.xmlPath;
  }
  protected populate(component: MetadataComponent, trigger: SourcePath): MetadataComponent {
    component.sources = [trigger];
    return component;
  }
}

describe('BaseSourceAdapter', () => {
  it('Should reformat the fullName for folder types', () => {
    const path = join('path', 'to', 'kathys', 'A_Folder', 'My_Test.kathy-meta.xml');
    const type = mockRegistry.types.kathybates;
    const adapter = new DefaultSourceAdapter(type, mockRegistry);
    expect(adapter.getComponent(path)).to.deep.equal({
      fullName: 'A_Folder/My_Test',
      type,
      xml: path
    });
  });

  it('Should defer parsing metadata xml to child adapter if path is not a metadata xml', () => {
    const path = join('path', 'to', 'dwaynes', 'My_Test.js');
    const type = mockRegistry.types.dwaynejohnson;
    const adapter = new TestChildAdapter(type, mockRegistry);
    expect(adapter.getComponent(path)).to.deep.equal({
      fullName: 'a',
      type,
      xml: TestChildAdapter.xmlPath,
      sources: [path]
    });
  });

  it('Should defer parsing metadata xml to child adapter if path is not a root metadata xml', () => {
    const path = join('path', 'to', 'dwaynes', 'smallDwaynes', 'b.small-meta.xml');
    const type = mockRegistry.types.dwaynejohnson;
    const adapter = new TestChildAdapter(type, mockRegistry);
    expect(adapter.getComponent(path)).to.deep.equal({
      fullName: 'a',
      type,
      xml: TestChildAdapter.xmlPath,
      sources: [path]
    });
  });
});
