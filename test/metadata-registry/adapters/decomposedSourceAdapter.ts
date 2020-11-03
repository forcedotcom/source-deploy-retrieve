/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { DecomposedSourceAdapter } from '../../../src/metadata-registry/adapters/decomposedSourceAdapter';
import { mockRegistry, regina, decomposedtoplevel, mockRegistryData } from '../../mock/registry';
import { expect } from 'chai';
import { VirtualTreeContainer } from '../../../src/metadata-registry/treeContainers';
import { SourceComponent } from '../../../src/metadata-registry';

describe('DecomposedSourceAdapter', () => {
  const type = mockRegistryData.types.reginaking;
  const tree = new VirtualTreeContainer(regina.REGINA_VIRTUAL_FS);
  const adapter = new DecomposedSourceAdapter(type, mockRegistry, undefined, tree);
  const expectedComponent = new SourceComponent(regina.REGINA_COMPONENT, tree);
  const children = expectedComponent.getChildren();

  it('should return expected SourceComponent when given a root metadata xml path', () => {
    expect(adapter.getComponent(regina.REGINA_XML_PATH)).to.deep.equal(expectedComponent);
  });

  it('should return expected SourceComponent when given a child xml', () => {
    const expectedChild = children.find((c) => c.xml === regina.REGINA_CHILD_XML_PATH_1);
    expect(adapter.getComponent(regina.REGINA_CHILD_XML_PATH_1)).to.deep.equal(expectedChild);
  });

  it('should return expected SourceComponent when given a child xml in its decomposed folder', () => {
    const expectedChild = children.find((c) => c.xml === regina.REGINA_CHILD_XML_PATH_2);
    expect(adapter.getComponent(regina.REGINA_CHILD_XML_PATH_2)).to.deep.equal(expectedChild);
  });

  it('should create a parent placeholder component if parent xml does not exist', () => {
    const fsNoParentXml = [
      {
        dirPath: regina.REGINA_PATH,
        children: [regina.REGINA_CHILD_XML_NAME_1, regina.REGINA_CHILD_DIR],
      },
      {
        dirPath: regina.REGINA_CHILD_DIR_PATH,
        children: [regina.REGINA_CHILD_XML_NAME_2],
      },
    ];
    const tree = new VirtualTreeContainer(fsNoParentXml);
    const adapter = new DecomposedSourceAdapter(type, mockRegistry, undefined, tree);
    const expectedParent = new SourceComponent({ name: regina.REGINA_COMPONENT.name, type }, tree);

    expect(adapter.getComponent(regina.REGINA_CHILD_XML_PATH_2).parent).to.deep.equal(
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
});
