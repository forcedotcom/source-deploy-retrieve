/*
 * Copyright 2025, Salesforce, Inc.
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
import { assert, expect } from 'chai';
import { DecomposedSourceAdapter, DefaultSourceAdapter } from '../../../src/resolve/adapters';
import { decomposed, decomposedtoplevel, xmlInFolder } from '../../mock';
import { registry, RegistryAccess, SourceComponent, VirtualTreeContainer } from '../../../src';
import { RegistryTestUtil } from '../registryTestUtil';
import { META_XML_SUFFIX } from '../../../src/common';

describe('DecomposedSourceAdapter', () => {
  const registryAccess = new RegistryAccess();
  const type = registry.types.customobject;
  const tree = new VirtualTreeContainer(decomposed.DECOMPOSED_VIRTUAL_FS);
  const adapter = new DecomposedSourceAdapter(type, registryAccess, undefined, tree);
  const expectedComponent = new SourceComponent(decomposed.DECOMPOSED_COMPONENT, tree);
  const children = expectedComponent.getChildren();

  it('should return expected SourceComponent when given a root metadata xml path', () => {
    expect(adapter.getComponent(decomposed.DECOMPOSED_XML_PATH)).to.deep.equal(expectedComponent);
  });

  it('should return expected SourceComponent when given a child xml', () => {
    const expectedChild = children.find((c) => c.xml === decomposed.DECOMPOSED_CHILD_XML_PATH_1);
    expect(adapter.getComponent(decomposed.DECOMPOSED_CHILD_XML_PATH_1)).to.deep.equal(expectedChild);
  });

  it('should set the component.content for a child when isResolvingSource = false', () => {
    const decompTree = new VirtualTreeContainer(decomposedtoplevel.DECOMPOSED_VIRTUAL_FS);
    const decompAdapter = new DecomposedSourceAdapter(
      registry.types.customobjecttranslation,
      registryAccess,
      undefined,
      decompTree
    );
    const expectedComp = new SourceComponent(decomposedtoplevel.DECOMPOSED_TOP_LEVEL_COMPONENT, decompTree);
    const childComp = decomposedtoplevel.DECOMPOSED_TOP_LEVEL_CHILD_XML_PATHS[0];
    expect(decompAdapter.getComponent(childComp, false)).to.deep.equal(expectedComp);
  });

  it('should return expected SourceComponent when given a child xml in its decomposed folder', () => {
    const expectedChild = children.find((c) => c.xml === decomposed.DECOMPOSED_CHILD_XML_PATH_2);
    expect(adapter.getComponent(decomposed.DECOMPOSED_CHILD_XML_PATH_2)).to.deep.equal(expectedChild);
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
    const adapter = new DecomposedSourceAdapter(type, registryAccess, undefined, tree);
    const expectedParent = new SourceComponent(
      { name: decomposed.DECOMPOSED_COMPONENT.name, type, content: decomposed.DECOMPOSED_PATH },
      tree
    );
    expect(adapter.getComponent(decomposed.DECOMPOSED_CHILD_XML_PATH_2)?.parent).to.deep.equal(expectedParent);
  });

  it('should return expected SourceComponent when given a topLevel parent component', () => {
    const type = registry.types.customobjecttranslation;
    const tree = new VirtualTreeContainer(decomposedtoplevel.DECOMPOSED_VIRTUAL_FS);
    const component = new SourceComponent(decomposedtoplevel.DECOMPOSED_TOP_LEVEL_COMPONENT, tree);
    const adapter = new DecomposedSourceAdapter(type, registryAccess, undefined, tree);
    expect(adapter.getComponent(decomposedtoplevel.DECOMPOSED_TOP_LEVEL_XML_PATH)).to.deep.equal(component);
  });

  it('should defer parsing metadata xml to child adapter if path is not a root metadata xml', () => {
    const component = decomposed.DECOMPOSED_CHILD_COMPONENT_1;
    assert(decomposed.DECOMPOSED_CHILD_COMPONENT_1.xml);
    const result = adapter.getComponent(decomposed.DECOMPOSED_CHILD_COMPONENT_1.xml);

    // @ts-ignore - this only failed when running 'yarn test' - parent has cache info the result won't
    component.parent.pathContentMap = new Map();
    expect(result).to.deep.equal(component);
  });

  it('should NOT throw an error if a parent metadata xml file is forceignored', () => {
    let testUtil: RegistryTestUtil | undefined;
    try {
      const path = join('path', 'to', type.directoryName, `My_Test.${type.suffix}${META_XML_SUFFIX}`);

      testUtil = new RegistryTestUtil();

      const forceIgnore = testUtil.stubForceIgnore({
        seed: path,
        deny: [path],
      });
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const adapter = new DecomposedSourceAdapter(type, registryAccess, forceIgnore, tree);
      const result = adapter.getComponent(path);
      expect(result).to.not.be.undefined;
    } catch (e) {
      expect(e).to.be.undefined;
    } finally {
      testUtil?.restore();
    }
  });

  it('should resolve a folder component in metadata format', () => {
    const component = xmlInFolder.FOLDER_COMPONENT_MD_FORMAT;
    assert(component.xml);
    const adapter = new DefaultSourceAdapter(component.type, registryAccess);

    expect(adapter.getComponent(component.xml)).to.deep.equal(component);
  });

  it('should not recognize an xml only component in metadata format when in the wrong directory', () => {
    // not in the right type directory
    const path = join('path', 'to', 'something', 'My_Test.xif');
    const type = registry.types.report;
    const adapter = new DefaultSourceAdapter(type, registryAccess);
    expect(adapter.getComponent(path)).to.be.undefined;
  });
});
