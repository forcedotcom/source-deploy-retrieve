/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { join } from 'node:path';
import { assert, expect } from 'chai';
import { getDecomposedComponent } from '../../../src/resolve/adapters/decomposedSourceAdapter';
import { decomposed, decomposedtoplevel, xmlInFolder } from '../../mock';
import {
  ForceIgnore,
  NodeFSTreeContainer,
  registry,
  RegistryAccess,
  SourceComponent,
  VirtualTreeContainer,
} from '../../../src';
import { META_XML_SUFFIX } from '../../../src/common';

describe('DecomposedSourceAdapter', () => {
  const registryAccess = new RegistryAccess();
  const type = registry.types.customobject;
  const tree = new VirtualTreeContainer(decomposed.DECOMPOSED_VIRTUAL_FS);
  const adapter = getDecomposedComponent({ tree, registry: registryAccess });
  const expectedComponent = new SourceComponent(decomposed.DECOMPOSED_COMPONENT, tree);
  const children = expectedComponent.getChildren();

  it('should return expected SourceComponent when given a root metadata xml path', () => {
    expect(adapter({ type, path: decomposed.DECOMPOSED_XML_PATH })).to.deep.equal(expectedComponent);
  });

  it('should return expected SourceComponent when given a child xml', () => {
    const expectedChild = children.find((c) => c.xml === decomposed.DECOMPOSED_CHILD_XML_PATH_1);
    expect(adapter({ type, path: decomposed.DECOMPOSED_CHILD_XML_PATH_1 })).to.deep.equal(expectedChild);
  });

  it('should set the component.content for a child when isResolvingSource = false', () => {
    const decompTree = new VirtualTreeContainer(decomposedtoplevel.DECOMPOSED_VIRTUAL_FS);
    const type = registry.types.customobjecttranslation;

    const decompAdapter = getDecomposedComponent({ tree: decompTree, registry: registryAccess });

    const expectedComp = new SourceComponent(decomposedtoplevel.DECOMPOSED_TOP_LEVEL_COMPONENT, decompTree);
    const childComp = decomposedtoplevel.DECOMPOSED_TOP_LEVEL_CHILD_XML_PATHS[0];
    expect(decompAdapter({ type, path: childComp })).to.deep.equal(expectedComp);
  });

  it('should return expected SourceComponent when given a child xml in its decomposed folder', () => {
    const expectedChild = children.find((c) => c.xml === decomposed.DECOMPOSED_CHILD_XML_PATH_2);
    expect(adapter({ path: decomposed.DECOMPOSED_CHILD_XML_PATH_2, type })).to.deep.equal(expectedChild);
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
    const adapter = getDecomposedComponent({ registry: registryAccess, tree });
    const expectedParent = new SourceComponent(
      { name: decomposed.DECOMPOSED_COMPONENT.name, type, content: decomposed.DECOMPOSED_PATH },
      tree
    );
    expect(adapter({ type, path: decomposed.DECOMPOSED_CHILD_XML_PATH_2 })?.parent).to.deep.equal(expectedParent);
  });

  it('should return expected SourceComponent when given a topLevel parent component', () => {
    const type = registry.types.customobjecttranslation;
    const tree = new VirtualTreeContainer(decomposedtoplevel.DECOMPOSED_VIRTUAL_FS);
    const component = new SourceComponent(decomposedtoplevel.DECOMPOSED_TOP_LEVEL_COMPONENT, tree);
    const adapter = getDecomposedComponent({ registry: registryAccess, tree });
    expect(adapter({ type, path: decomposedtoplevel.DECOMPOSED_TOP_LEVEL_XML_PATH })).to.deep.equal(component);
  });

  it('should defer parsing metadata xml to child adapter if path is not a root metadata xml', () => {
    const component = decomposed.DECOMPOSED_CHILD_COMPONENT_1;
    assert(decomposed.DECOMPOSED_CHILD_COMPONENT_1.xml);
    const result = adapter({ type, path: decomposed.DECOMPOSED_CHILD_COMPONENT_1.xml });

    expect(result).to.deep.equal(component);
  });

  it('should NOT throw an error if a parent metadata xml file is forceignored', () => {
    try {
      const path = join('path', 'to', type.directoryName, `My_Test.${type.suffix}${META_XML_SUFFIX}`);
      const forceIgnore = new ForceIgnore('', path);
      const adapter = getDecomposedComponent({ registry: registryAccess, forceIgnore, tree });
      const result = adapter({ type, path });
      expect(result).to.not.be.undefined;
    } catch (e) {
      expect(e).to.be.undefined;
    }
  });

  describe('mdapi format', () => {
    it('should resolve a folder component in metadata format', () => {
      const tree = new NodeFSTreeContainer();
      const adapter = getDecomposedComponent({ registry: registryAccess, tree });
      const component = xmlInFolder.FOLDER_COMPONENT_MD_FORMAT;
      assert(component.xml);
      // use a tree that doesn't include the mocks
      expect(adapter({ type: component.type, path: component.xml })).to.deep.equal(component);
    });

    it('should not recognize an xml only component in metadata format when in the wrong directory', () => {
      const path = join('path', 'to', 'something', 'My_Test.xif');
      const tree = VirtualTreeContainer.fromFilePaths([path]);
      const adapter = getDecomposedComponent({ registry: registryAccess, tree });
      // not in the right type directory
      const type = registry.types.report;
      expect(adapter({ type, path })).to.be.undefined;
    });
  });
});
