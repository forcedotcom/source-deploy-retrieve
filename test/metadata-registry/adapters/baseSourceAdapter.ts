/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { join } from 'path';
import { xmlInFolder, mockRegistry, mockRegistryData } from '../../mock/registry';
import { DefaultSourceAdapter } from '../../../src/metadata-registry/adapters/defaultSourceAdapter';
import { expect, assert } from 'chai';
import { BaseSourceAdapter } from '../../../src/metadata-registry/adapters/baseSourceAdapter';
import { META_XML_SUFFIX, SourcePath } from '../../../src/common';
import { UnexpectedForceIgnore } from '../../../src/errors';
import { nls } from '../../../src/i18n';
import { RegistryTestUtil } from '../registryTestUtil';
import { SourceComponent } from '../../../src/metadata-registry';

// TODO: Remove when tests replace with TestAdapter
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

class TestAdapter extends BaseSourceAdapter {
  public readonly component: SourceComponent;

  constructor(component: SourceComponent) {
    super(component.type, mockRegistry);
    this.component = component;
  }

  protected getRootMetadataXmlPath(): SourcePath {
    return this.component.xml;
  }
  protected populate(): SourceComponent {
    return this.component;
  }
}

describe('BaseSourceAdapter', () => {
  it('should reformat the fullName for folder types', () => {
    const component = xmlInFolder.COMPONENTS[0];
    const adapter = new TestAdapter(component);
    expect(adapter.getComponent(component.xml)).to.deep.equal(component);
  });

  it('should defer parsing metadata xml to child adapter if path is not a metadata xml', () => {
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

  it('should defer parsing metadata xml to child adapter if path is not a root metadata xml', () => {
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

  it('should throw an error if a metadata xml file is forceignored', () => {
    const testUtil = new RegistryTestUtil();
    const type = mockRegistryData.types.matchingcontentfile;
    const path = join('path', 'to', type.directoryName, `My_Test.${type.suffix}${META_XML_SUFFIX}`);
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

  it('should resolve a folder component in metadata format', () => {
    const component = xmlInFolder.FOLDER_COMPONENT_MD_FORMAT;
    const adapter = new DefaultSourceAdapter(component.type, mockRegistry);

    expect(adapter.getComponent(component.xml)).to.deep.equal(component);
  });

  it('should not recognize an xml only component in metadata format when in the wrong directory', () => {
    // not in the right type directory
    const path = join('path', 'to', 'something', 'My_Test.xif');
    const type = mockRegistryData.types.xmlinfolder;
    const adapter = new DefaultSourceAdapter(type, mockRegistry);
    expect(adapter.getComponent(path)).to.be.undefined;
  });
});
