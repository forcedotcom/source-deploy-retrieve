/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { join } from 'path';
import { mockRegistry, mockRegistryData } from '../../mock/registry';
import { DefaultSourceAdapter } from '../../../src/metadata-registry/adapters/defaultSourceAdapter';
import { expect, assert } from 'chai';
import { BaseSourceAdapter } from '../../../src/metadata-registry/adapters/baseSourceAdapter';
import { SourcePath } from '../../../src/common';
import { UnexpectedForceIgnore } from '../../../src/errors';
import { nls } from '../../../src/i18n';
import { RegistryTestUtil } from '../registryTestUtil';
import { SourceComponent } from '../../../src/metadata-registry';

class TestChildAdapter extends BaseSourceAdapter {
  public static readonly xmlPath = join('path', 'to', 'dwaynes', 'a.dwayne-meta.xml');
  protected getRootMetadataXmlPath(): SourcePath {
    return TestChildAdapter.xmlPath;
  }
  protected populate(trigger: SourcePath, component: SourceComponent): SourceComponent {
    component.content = trigger;
    return component;
  }
}

describe('BaseSourceAdapter', () => {
  it('Should reformat the fullName for folder types', () => {
    const path = join('path', 'to', 'kathys', 'A_Folder', 'My_Test.kathy-meta.xml');
    const type = mockRegistryData.types.kathybates;
    const adapter = new DefaultSourceAdapter(type, mockRegistry);
    expect(adapter.getComponent(path)).to.deep.equal(
      new SourceComponent({
        name: 'A_Folder/My_Test',
        type,
        xml: path,
      })
    );
  });

  it('Should defer parsing metadata xml to child adapter if path is not a metadata xml', () => {
    const path = join('path', 'to', 'dwaynes', 'My_Test.js');
    const type = mockRegistryData.types.dwaynejohnson;
    const adapter = new TestChildAdapter(type, mockRegistry);
    expect(adapter.getComponent(path)).to.deep.equal(
      new SourceComponent({
        name: 'a',
        type,
        xml: TestChildAdapter.xmlPath,
        content: path,
      })
    );
  });

  it('Should defer parsing metadata xml to child adapter if path is not a root metadata xml', () => {
    const path = join('path', 'to', 'dwaynes', 'smallDwaynes', 'b.small-meta.xml');
    const type = mockRegistryData.types.dwaynejohnson;
    const adapter = new TestChildAdapter(type, mockRegistry);
    expect(adapter.getComponent(path)).to.deep.equal(
      new SourceComponent({
        name: 'a',
        type,
        xml: TestChildAdapter.xmlPath,
        content: path,
      })
    );
  });

  it('Should throw an error if a metadata xml file is forceignored', () => {
    const testUtil = new RegistryTestUtil();
    const path = join('path', 'to', 'keanus', 'My_Test.keanu-meta.xml');
    const type = mockRegistryData.types.keanureeves;
    const forceIgnore = testUtil.stubForceIgnore({
      seed: path,
      deny: [path],
    });
    const adapter = new TestChildAdapter(type, mockRegistry, forceIgnore);
    assert.throws(
      () => adapter.getComponent(path),
      UnexpectedForceIgnore,
      nls.localize('error_no_metadata_xml_ignore', [path, path])
    );
    testUtil.restore();
  });

  it('Should resolve a folder component', () => {
    const path = join('path', 'to', 'seans', 'My_Test-meta.xml');
    const type = mockRegistryData.types.seanfolder;
    const adapter = new DefaultSourceAdapter(type, mockRegistry);
    expect(adapter.getComponent(path)).to.deep.equal(
      new SourceComponent({
        name: 'My_Test',
        type,
        xml: path,
      })
    );
  });

  it('Should not recognize a content metadata file in the wrong directory', () => {
    const path = join('path', 'to', 'genes', 'My_Test.sean');
    const type = mockRegistryData.types.seanconnerys;
    const adapter = new DefaultSourceAdapter(type, mockRegistry);
    expect(adapter.getComponent(path)).to.be.undefined;
  });
});
