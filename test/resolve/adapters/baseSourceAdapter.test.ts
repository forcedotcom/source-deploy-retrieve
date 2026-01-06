/*
 * Copyright 2026, Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { join } from 'node:path';
import { Messages, SfError } from '@salesforce/core';

import { assert, expect } from 'chai';
import {
  decomposed,
  matchingContentFile,
  mixedContentSingleFile,
  nestedTypes,
  xmlInFolder,
  document,
} from '../../mock';
import { BaseSourceAdapter, DefaultSourceAdapter } from '../../../src/resolve/adapters';
import { META_XML_SUFFIX } from '../../../src/common';
import { RegistryTestUtil } from '../registryTestUtil';
import { ForceIgnore, registry, SourceComponent } from '../../../src';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/source-deploy-retrieve', 'sdr');

class TestAdapter extends BaseSourceAdapter {
  public readonly component: SourceComponent;

  public constructor(component: SourceComponent, forceIgnore?: ForceIgnore) {
    super(component.type, undefined, forceIgnore);
    this.component = component;
  }

  protected getRootMetadataXmlPath(): string {
    assert(this.component.xml);
    return this.component.xml;
  }
  protected populate(): SourceComponent {
    return this.component;
  }
}

describe('BaseSourceAdapter', () => {
  it('should reformat the fullName for folder types', () => {
    const component = xmlInFolder.COMPONENTS[0];
    assert(component.xml);
    const adapter = new TestAdapter(component);

    const result = adapter.getComponent(component.xml);

    expect(result).to.deep.equal(component);
  });

  it('should defer parsing metadata xml to child adapter if path is not a metadata xml', () => {
    const component = mixedContentSingleFile.COMPONENT;
    const adapter = new TestAdapter(component);
    assert(component.content);

    const result = adapter.getComponent(component.content);

    expect(result).to.deep.equal(component);
  });

  it('should defer parsing metadata xml to child adapter if path is not a root metadata xml', () => {
    const component = decomposed.DECOMPOSED_CHILD_COMPONENT_1;
    const adapter = new TestAdapter(component);
    assert(decomposed.DECOMPOSED_CHILD_COMPONENT_1.xml);
    const result = adapter.getComponent(decomposed.DECOMPOSED_CHILD_COMPONENT_1.xml);

    expect(result).to.deep.equal(component);
  });

  it('should throw an error if a metadata xml file is forceignored', () => {
    const testUtil = new RegistryTestUtil();
    const type = registry.types.apexclass;
    const path = join('path', 'to', type.directoryName, `My_Test.${type.suffix}${META_XML_SUFFIX}`);
    const forceIgnore = testUtil.stubForceIgnore({
      seed: path,
      deny: [path],
    });
    const adapter = new TestAdapter(matchingContentFile.COMPONENT, forceIgnore);

    assert.throws(
      () => adapter.getComponent(path),
      SfError,
      messages.getMessage('error_no_metadata_xml_ignore', [path, path])
    );
    testUtil.restore();
  });

  it('should resolve a folder component in metadata format', () => {
    const component = xmlInFolder.FOLDER_COMPONENT_MD_FORMAT;
    assert(component.xml);
    const adapter = new DefaultSourceAdapter(component.type, undefined);

    expect(adapter.getComponent(component.xml)).to.deep.equal(component);
  });

  it('should resolve a nested folder component in metadata format (document)', () => {
    const component = new SourceComponent({
      name: `subfolder/${document.COMPONENT_FOLDER_NAME}`,
      type: registry.types.document,
      xml: join(document.DOCUMENTS_DIRECTORY, 'subfolder', `${document.COMPONENT_FOLDER_NAME}${META_XML_SUFFIX}`),
      parentType: registry.types.documentfolder,
    });
    assert(component.xml);

    const adapter = new DefaultSourceAdapter(component.type);

    expect(adapter.getComponent(component.xml)).to.deep.equal(component);
  });

  it('should not recognize an xml only component in metadata format when in the wrong directory', () => {
    // not in the right type directory
    const path = join('path', 'to', 'something', 'My_Test.xif');
    const type = registry.types.document;
    const adapter = new DefaultSourceAdapter(type);
    expect(adapter.getComponent(path)).to.be.undefined;
  });

  describe('handling nested types (Territory2Model)', () => {
    // mocha was throwing errors about private property _tree not matching
    const sourceComponentKeys: Array<keyof SourceComponent> = [
      'type',
      'name',
      'xml',
      'parent',
      'parentType',
      'content',
    ];

    it('should resolve the parent name and type', () => {
      const component = nestedTypes.NESTED_PARENT_COMPONENT;
      assert(component.xml);

      const adapter = new DefaultSourceAdapter(component.type);
      const componentFromAdapter = adapter.getComponent(component.xml);
      assert(componentFromAdapter);

      sourceComponentKeys.map((prop) => expect(componentFromAdapter[prop]).to.deep.equal(component[prop]));
    });

    it('should resolve the child name and type AND parentType', () => {
      const component = nestedTypes.NESTED_CHILD_COMPONENT;
      assert(component.xml);
      const adapter = new DefaultSourceAdapter(component.type);
      const componentFromAdapter = adapter.getComponent(component.xml);
      assert(componentFromAdapter);
      sourceComponentKeys.map((prop) => {
        expect(componentFromAdapter[prop]).to.deep.equal(component[prop]);
      });
    });
  });
});
