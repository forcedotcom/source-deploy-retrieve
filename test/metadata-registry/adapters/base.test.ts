import { join } from 'path';
import { mockRegistry } from '../../mock/registry';
import { BaseSourceAdapter } from '../../../src/metadata-registry/adapters/base';
import { expect, assert } from 'chai';
import { createSandbox, SinonStub } from 'sinon';
import * as fs from 'fs';
import { SourcePath } from '../../../src/metadata-registry';
import { RegistryError } from '../../../src/errors';
import { nls } from '../../../src/i18n';

const env = createSandbox();

describe('BaseSourceAdapter', () => {
  let existsStub: SinonStub;

  beforeEach(() => (existsStub = env.stub(fs, 'existsSync')));
  afterEach(() => env.restore());

  it('Should return a MetadataComponent when given a metadata xml file', () => {
    const path = join('path', 'to', 'keanus', 'My_Test.keanu-meta.xml');
    const type = mockRegistry.types.keanureeves;
    const adapter = new BaseSourceAdapter(type);
    expect(adapter.getComponent(path)).to.deep.equal({
      fullName: 'My_Test',
      type,
      metaXml: path,
      sources: []
    });
  });

  it('Should reformat the fullName for folder types', () => {
    const path = join(
      'path',
      'to',
      'kathys',
      'A_Folder',
      'My_Test.kathy-meta.xml'
    );
    const type = mockRegistry.types.kathybates;
    const adapter = new BaseSourceAdapter(type);
    expect(adapter.getComponent(path)).to.deep.equal({
      fullName: 'A_Folder/My_Test',
      type,
      metaXml: path,
      sources: []
    });
  });

  it('Should defer parsing metadata xml to child adapter if path is not a metadata xml', () => {
    const path = join('path', 'to', 'dwaynes', 'My_Test.js');
    const type = mockRegistry.types.dwaynejohnson;
    const adapter = new TestChildAdapter(type);
    expect(adapter.getComponent(path)).to.deep.equal({
      fullName: 'a',
      type,
      metaXml: TestChildAdapter.xmlPath,
      sources: [path]
    });
  });

  it('Should defer parsing metadata xml to child adapter if path is not a root metadata xml', () => {
    const path = join(
      'path',
      'to',
      'dwaynes',
      'smallDwaynes',
      'b.small-meta.xml'
    );
    const type = mockRegistry.types.dwaynejohnson;
    const adapter = new TestChildAdapter(type);
    expect(adapter.getComponent(path)).to.deep.equal({
      fullName: 'a',
      type,
      metaXml: TestChildAdapter.xmlPath,
      sources: [path]
    });
  });

  it('Should throw an error if directly using adapter and path is not a root metadata xml', () => {
    const path = join('path', 'to', 'dwaynes', 'My_Test.js');
    const type = mockRegistry.types.dwaynejohnson;
    const adapter = new BaseSourceAdapter(type);
    assert.throws(
      () => adapter.getComponent(path),
      RegistryError,
      nls.localize('error_missing_metadata_xml', [path, type.name])
    );
  });
});

class TestChildAdapter extends BaseSourceAdapter {
  public static readonly xmlPath = join(
    'path',
    'to',
    'dwaynes',
    'a.dwayne-meta.xml'
  );
  protected getMetadataXmlPath(pathToSource: string) {
    return TestChildAdapter.xmlPath;
  }
  protected getSourcePaths(fsPath: SourcePath, isMetaXml: boolean) {
    return [fsPath];
  }
}
