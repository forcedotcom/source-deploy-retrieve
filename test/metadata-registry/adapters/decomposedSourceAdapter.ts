/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { DecomposedSourceAdapter } from '../../../src/metadata-registry/adapters/decomposedSourceAdapter';
import { mockRegistry, regina } from '../../mock/registry';
import { expect } from 'chai';
import { VirtualTreeContainer } from '../../../src/metadata-registry/treeContainers';
import { StandardSourceComponent } from '../../../src/metadata-registry';

describe('DecomposedSourceAdapter', () => {
  const type = mockRegistry.types.reginaking;
  const tree = new VirtualTreeContainer([
    {
      dirPath: regina.REGINA_PATH,
      children: [regina.REGINA_XML_NAME, regina.REGINA_CHILD_XML_NAME_1, regina.REGINA_CHILD_DIR]
    },
    {
      dirPath: regina.REGINA_CHILD_DIR_PATH,
      children: [regina.REGINA_CHILD_XML_NAME_2]
    }
  ]);
  const adapter = new DecomposedSourceAdapter(type, mockRegistry, undefined, tree);
  const expectedComponent = new StandardSourceComponent(regina.REGINA_COMPONENT, tree);
  const children = expectedComponent.getChildren();

  it('should return expected SourceComponent when given a root metadata xml path', () => {
    expect(adapter.getComponent(regina.REGINA_XML_PATH)).to.deep.equal(expectedComponent);
  });

  it('should return expected SourceComponent when given a child xml', () => {
    const expectedChild = children.find(c => c.xml === regina.REGINA_CHILD_XML_PATH_1);
    expect(adapter.getComponent(regina.REGINA_CHILD_XML_PATH_1)).to.deep.equal(expectedChild);
  });

  it('should return expected SourceComponent when given a child xml in its decomposed folder', () => {
    const expectedChild = children.find(c => c.xml === regina.REGINA_CHILD_XML_PATH_2);
    expect(adapter.getComponent(regina.REGINA_CHILD_XML_PATH_2)).to.deep.equal(expectedChild);
  });

  // TODO: Move to StandardSourceComponent tests
  // it('should not include children that are forceignored', () => {
  //   const testUtil = new RegistryTestUtil();
  //   const forceIgnore = testUtil.stubForceIgnore({
  //     seed: regina.REGINA_XML_PATH,
  //     deny: [regina.REGINA_CHILD_XML_PATH_2]
  //   });
  //   adapter = new DecomposedSourceAdapter(type, mockRegistry, forceIgnore, tree);
  //   expect(adapter.getComponent(regina.REGINA_XML_PATH)).to.deep.equal({
  //     fullName: regina.REGINA_COMPONENT.fullName,
  //     type: regina.REGINA_COMPONENT.type,
  //     xml: regina.REGINA_COMPONENT.xml,
  //     // we know there is a child
  //     // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  //     children: [regina.REGINA_COMPONENT.children![0]]
  //   });
  //   testUtil.restore();
  // });
});
