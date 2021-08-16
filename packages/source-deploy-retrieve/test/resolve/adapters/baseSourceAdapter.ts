/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { join } from 'path';
import { expect, assert } from 'chai';
import {
  xmlInFolder,
  mockRegistry,
  mockRegistryData,
  mixedContentSingleFile,
  decomposed,
  matchingContentFile,
} from '../../mock/registry';
import { BaseSourceAdapter, DefaultSourceAdapter } from '../../../src/resolve/adapters';
import { META_XML_SUFFIX } from '../../../src/common';
import { UnexpectedForceIgnore } from '../../../src/errors';
import { nls } from '../../../src/i18n';
import { RegistryTestUtil } from '../registryTestUtil';
import { ForceIgnore, SourceComponent } from '../../../src';

class TestAdapter extends BaseSourceAdapter {
  public readonly component: SourceComponent;

  constructor(component: SourceComponent, forceIgnore?: ForceIgnore) {
    super(component.type, mockRegistry, forceIgnore);
    this.component = component;
  }

  protected getRootMetadataXmlPath(): string {
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

    const result = adapter.getComponent(component.xml);

    expect(result).to.deep.equal(component);
  });

  it('should defer parsing metadata xml to child adapter if path is not a metadata xml', () => {
    const component = mixedContentSingleFile.COMPONENT;
    const adapter = new TestAdapter(component);

    const result = adapter.getComponent(component.content);

    expect(result).to.deep.equal(component);
  });

  it('should defer parsing metadata xml to child adapter if path is not a root metadata xml', () => {
    const component = decomposed.DECOMPOSED_CHILD_COMPONENT_1;
    const adapter = new TestAdapter(component);

    const result = adapter.getComponent(decomposed.DECOMPOSED_CHILD_COMPONENT_1.xml);

    expect(result).to.deep.equal(component);
  });

  it('should throw an error if a metadata xml file is forceignored', () => {
    const testUtil = new RegistryTestUtil();
    const type = mockRegistryData.types.matchingcontentfile;
    const path = join('path', 'to', type.directoryName, `My_Test.${type.suffix}${META_XML_SUFFIX}`);
    const forceIgnore = testUtil.stubForceIgnore({
      seed: path,
      deny: [path],
    });
    const adapter = new TestAdapter(matchingContentFile.COMPONENT, forceIgnore);
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
