/*	
 * Copyright (c) 2020, salesforce.com, inc.	
 * All rights reserved.	
 * Licensed under the BSD 3-Clause license.	
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause	
 */
import { join } from 'path';
import { mockRegistry } from '../../mock/registry';
import { DefaultSourceAdapter } from '../../../src/metadata-registry/adapters/defaultSourceAdapter';
import { expect, assert } from 'chai';
import { BaseSourceAdapter } from '../../../src/metadata-registry/adapters/baseSourceAdapter';
import { SourcePath, MetadataComponent } from '../../../src/types';
import { RegistryError, UnexpectedForceIgnore } from '../../../src/errors';
import { nls } from '../../../src/i18n';
import { RegistryTestUtil } from '../registryTestUtil';

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

  it('Should throw an error if no valid root metadata xml found', () => {
    const path = join('path', 'to', 'dwaynes', 'My_Test.js');
    const type = mockRegistry.types.dwaynejohnson;
    const adapter = new DefaultSourceAdapter(type, mockRegistry);
    assert.throws(
      () => adapter.getComponent(path),
      RegistryError,
      nls.localize('error_missing_metadata_xml', [path, type.name])
    );
  });

  it('Should throw an error if a metadata xml file is forceignored', () => {
    const testUtil = new RegistryTestUtil();
    testUtil.initStubs();
    const path = join('path', 'to', 'keanus', 'My_Test.keanu-meta.xml');
    const type = mockRegistry.types.keanureeves;
    const forceIgnore = testUtil.stubForceIgnore({
      seed: path,
      deny: [path]
    });
    const adapter = new TestChildAdapter(type, mockRegistry, forceIgnore);
    assert.throws(
      () => adapter.getComponent(path),
      UnexpectedForceIgnore,
      nls.localize('error_no_metadata_xml_ignore', [path, path])
    );
    testUtil.restore();
  });
});
