/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Decomposed } from '../../../src/metadata-registry/adapters/decomposed';
import { mockRegistry, regina } from '../../mock/registry';
import { RegistryTestUtil } from '../registryTestUtil';
import { expect } from 'chai';

describe('Decomposed', () => {
  let adapter = new Decomposed(mockRegistry.types.reginaking, mockRegistry);
  const testUtil = new RegistryTestUtil();

  beforeEach(() => {
    testUtil.initStubs();
    testUtil.stubDirectories([
      {
        directory: regina.REGINA_PATH,
        fileNames: [regina.REGINA_XML_NAME, regina.REGINA_CHILD_XML_NAME_1, regina.REGINA_CHILD_DIR]
      },
      {
        directory: regina.REGINA_CHILD_DIR_PATH,
        fileNames: [regina.REGINA_CHILD_XML_NAME_2]
      }
    ]);
  });
  afterEach(() => testUtil.restore());

  it('should return expected MetadataComponent when given a root metadata xml path', () => {
    expect(adapter.getComponent(regina.REGINA_XML_PATH)).to.deep.equal(regina.REGINA_COMPONENT);
  });

  it('should return expected MetadataComponent when given a child xml', () => {
    expect(adapter.getComponent(regina.REGINA_CHILD_XML_PATH_1)).to.deep.equal(
      regina.REGINA_COMPONENT
    );
  });

  it('should return expected MetadataComponent when given a child xml in its decomposed folder', () => {
    expect(adapter.getComponent(regina.REGINA_CHILD_XML_PATH_2)).to.deep.equal(
      regina.REGINA_COMPONENT
    );
  });

  it('should not include children that are forceignored', () => {
    const forceIgnore = testUtil.stubForceIgnore({
      seed: regina.REGINA_XML_PATH,
      deny: [regina.REGINA_CHILD_XML_PATH_2]
    });
    adapter = new Decomposed(mockRegistry.types.reginaking, mockRegistry, forceIgnore);
    expect(adapter.getComponent(regina.REGINA_XML_PATH)).to.deep.equal({
      fullName: regina.REGINA_COMPONENT.fullName,
      type: regina.REGINA_COMPONENT.type,
      xml: regina.REGINA_COMPONENT.xml,
      // we know there is a child
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      children: [regina.REGINA_COMPONENT.children![0]]
    });
  });
});
