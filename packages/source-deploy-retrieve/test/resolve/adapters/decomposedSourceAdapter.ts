/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { DecomposedSourceAdapter, DefaultSourceAdapter } from '../../../src/resolve/adapters';
import {
  mockRegistry,
  decomposed,
  decomposedtoplevel,
  mockRegistryData,
  xmlInFolder,
} from '../../mock/registry';
import { expect } from 'chai';
import { VirtualTreeContainer, SourceComponent } from '../../../src';
import { RegistryTestUtil } from '../registryTestUtil';
import { join } from 'path';
import { META_XML_SUFFIX } from '../../../src/common';

describe('DecomposedSourceAdapter', () => {
  const type = mockRegistryData.types.decomposed;
  const tree = new VirtualTreeContainer(decomposed.DECOMPOSED_VIRTUAL_FS);
  const adapter = new DecomposedSourceAdapter(type, mockRegistry, undefined, tree);
  const expectedComponent = new SourceComponent(decomposed.DECOMPOSED_COMPONENT, tree);
  const children = expectedComponent.getChildren();

  it('should return expected SourceComponent when given a root metadata xml path', () => {
    expect(adapter.getComponent(decomposed.DECOMPOSED_XML_PATH)).to.deep.equal(expectedComponent);
  });

  it('should return expected SourceComponent when given a child xml', () => {
    const expectedChild = children.find((c) => c.xml === decomposed.DECOMPOSED_CHILD_XML_PATH_1);
    expect(adapter.getComponent(decomposed.DECOMPOSED_CHILD_XML_PATH_1)).to.deep.equal(
      expectedChild
    );
  });

  it('should return expected SourceComponent when given a child xml in its decomposed folder', () => {
    const expectedChild = children.find((c) => c.xml === decomposed.DECOMPOSED_CHILD_XML_PATH_2);
    expect(adapter.getComponent(decomposed.DECOMPOSED_CHILD_XML_PATH_2)).to.deep.equal(
      expectedChild
    );
  });

  it('should create a parent placeholder component if parent xml does not exist', () => {
    const fsNoParentXml = [
      {
        dirPath: decomposed.DECOMPOSED_PATH,
        children: [decomposed.DECOMPOSED_CHILD_XML_NAME_1, decomposed.DECOMPOSED_CHILD_DIR],
      },
      {
        dirPath: decomposed.DECOMPOSED_CHILD_DIR_PATH,
        children: [decomposed.DECOMPOSED_CHILD_XML_NAME_2],
      },
    ];
    const tree = new VirtualTreeContainer(fsNoParentXml);
    const adapter = new DecomposedSourceAdapter(type, mockRegistry, undefined, tree);
    const expectedParent = new SourceComponent(
      { name: decomposed.DECOMPOSED_COMPONENT.name, type, content: decomposed.DECOMPOSED_PATH },
      tree
    );

    expect(adapter.getComponent(decomposed.DECOMPOSED_CHILD_XML_PATH_2).parent).to.deep.equal(
      expectedParent
    );
  });

  it('should return expected SourceComponent when given a topLevel parent component', () => {
    const type = mockRegistryData.types.decomposedtoplevel;
    const tree = new VirtualTreeContainer(decomposedtoplevel.DECOMPOSED_VIRTUAL_FS);
    const component = new SourceComponent(decomposedtoplevel.DECOMPOSED_TOP_LEVEL_COMPONENT, tree);
    const adapter = new DecomposedSourceAdapter(type, mockRegistry, undefined, tree);
    expect(adapter.getComponent(decomposedtoplevel.DECOMPOSED_TOP_LEVEL_XML_PATH)).to.deep.equal(
      component
    );
  });

  it('should defer parsing metadata xml to child adapter if path is not a root metadata xml', () => {
    const component = decomposed.DECOMPOSED_CHILD_COMPONENT_1;
    const result = adapter.getComponent(decomposed.DECOMPOSED_CHILD_COMPONENT_1.xml);

    expect(result).to.deep.equal(component);
  });

  it('should NOT throw an error if a parent metadata xml file is forceignored', () => {
    let testUtil;
    try {
      const path = join(
        'path',
        'to',
        type.directoryName,
        `My_Test.${type.suffix}${META_XML_SUFFIX}`
      );

      testUtil = new RegistryTestUtil();

      const forceIgnore = testUtil.stubForceIgnore({
        seed: path,
        deny: [path],
      });
      const adapter = new DecomposedSourceAdapter(type, mockRegistry, forceIgnore, tree);
      const result = adapter.getComponent(path);
      expect(result).to.not.be.undefined;
    } catch (e) {
      expect(e).to.be.undefined;
    } finally {
      testUtil.restore();
    }
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
