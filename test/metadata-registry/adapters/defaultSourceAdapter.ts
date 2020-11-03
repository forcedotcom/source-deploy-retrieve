/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { join } from 'path';
import { mockRegistry, mockRegistryData } from '../../mock/registry';
import { DefaultSourceAdapter } from '../../../src/metadata-registry/adapters/defaultSourceAdapter';
import { expect } from 'chai';
import { SourceComponent } from '../../../src/metadata-registry';

describe('DefaultSourceAdapter', () => {
  it('should return a SourceComponent when given a metadata xml file', () => {
    const path = join('path', 'to', 'keanus', 'My_Test.keanu-meta.xml');
    const type = mockRegistryData.types.keanureeves;
    const adapter = new DefaultSourceAdapter(type, mockRegistry);
    expect(adapter.getComponent(path)).to.deep.equal(
      new SourceComponent({
        name: 'My_Test',
        type,
        xml: path,
      })
    );
  });

  it('should return a SourceComponent when given a content-only metadata file', () => {
    const path = join('path', 'to', 'keanus', 'My_Test.keanu');
    const type = mockRegistryData.types.keanureeves;
    const adapter = new DefaultSourceAdapter(type, mockRegistry);
    expect(adapter.getComponent(path)).to.deep.equal(
      new SourceComponent({
        name: 'My_Test',
        type,
        xml: path,
      })
    );
  });
});
