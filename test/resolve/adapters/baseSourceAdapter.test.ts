/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { join } from 'node:path';
import { Messages, SfError } from '@salesforce/core';

import { assert, expect } from 'chai';
import { posixify } from '../../../src/utils/path';
import { decomposed, mixedContentSingleFile, nestedTypes, xmlInFolder, document } from '../../mock';
import { getComponent } from '../../../src/resolve/adapters/baseSourceAdapter';
import { META_XML_SUFFIX } from '../../../src/common';
import { ForceIgnore, NodeFSTreeContainer, RegistryAccess, SourceComponent } from '../../../src';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/source-deploy-retrieve', 'sdr');

describe('BaseSourceAdapter', () => {
  const registry = new RegistryAccess();
  const tree = new NodeFSTreeContainer();
  const adapter = getComponent({
    registry,
    forceIgnore: new ForceIgnore(),
    tree,
  });
  it('should reformat the fullName for folder types', () => {
    const component = xmlInFolder.COMPONENTS[0];
    assert(component.xml);
    const result = adapter({ path: component.xml, type: component.type });
    expect(result).to.deep.equal(component);
  });

  it.skip('should defer parsing metadata xml to child adapter if path is not a metadata xml', () => {
    const component = mixedContentSingleFile.COMPONENT;
    const adapter = getComponent({ tree: component.tree, registry });
    assert(component.content);

    const result = adapter({ path: component.content, type: component.type });

    expect(result).to.deep.equal(component);
  });

  it.skip('should defer parsing metadata xml to child adapter if path is not a root metadata xml', () => {
    const component = decomposed.DECOMPOSED_CHILD_COMPONENT_1;
    assert(decomposed.DECOMPOSED_CHILD_COMPONENT_1.xml);
    const result = adapter({
      path: decomposed.DECOMPOSED_CHILD_COMPONENT_1.xml,
      type: decomposed.DECOMPOSED_CHILD_COMPONENT_1.type,
    });

    expect(result).to.deep.equal(component);
  });

  it('should throw an error if a metadata xml file is forceignored', () => {
    const type = registry.getRegistry().types.apexclass;
    const path = join('path', 'to', type.directoryName, `My_Test.${type.suffix}${META_XML_SUFFIX}`);
    const adapterWithIgnore = getComponent({ tree, registry, forceIgnore: new ForceIgnore('', posixify(path)) });

    assert.throws(
      () => adapterWithIgnore({ path, type }),
      SfError,
      messages.getMessage('error_no_metadata_xml_ignore', [path, path])
    );
  });

  it('should resolve a folder component in metadata format', () => {
    const component = xmlInFolder.FOLDER_COMPONENT_MD_FORMAT;
    assert(component.xml);

    expect(adapter({ path: component.xml, type: component.type })).to.deep.equal(component);
  });

  it('should resolve a nested folder component in metadata format (document)', () => {
    const component = new SourceComponent({
      name: `subfolder/${document.COMPONENT_FOLDER_NAME}`,
      type: registry.getRegistry().types.document,
      xml: join(document.DOCUMENTS_DIRECTORY, 'subfolder', `${document.COMPONENT_FOLDER_NAME}${META_XML_SUFFIX}`),
      parentType: registry.getRegistry().types.documentfolder,
    });
    assert(component.xml);

    expect(adapter({ path: component.xml, type: component.type })).to.deep.equal(component);
  });

  it.skip('should not recognize an xml only component in metadata format when in the wrong directory', () => {
    // not in the right type directory
    const path = join('path', 'to', 'something', 'My_Test.xif');
    const type = registry.getRegistry().types.document;
    expect(adapter({ path, type })).to.be.undefined;
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

      const componentFromAdapter = adapter({ path: component.xml, type: component.type });
      assert(componentFromAdapter);

      sourceComponentKeys.map((prop) => expect(componentFromAdapter[prop]).to.deep.equal(component[prop]));
    });

    it('should resolve the child name and type AND parentType', () => {
      const component = nestedTypes.NESTED_CHILD_COMPONENT;
      assert(component.xml);
      const componentFromAdapter = adapter({ path: component.xml, type: component.type });
      assert(componentFromAdapter);
      sourceComponentKeys.map((prop) => {
        expect(componentFromAdapter[prop]).to.deep.equal(component[prop]);
      });
    });
  });
});
