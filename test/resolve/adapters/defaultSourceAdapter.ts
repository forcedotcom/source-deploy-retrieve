/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { join } from 'path';
import { mockRegistry, mockRegistryData } from '../../mock/registry';
import { DefaultSourceAdapter } from '../../../src/resolve/adapters/defaultSourceAdapter';
import { expect } from 'chai';
import { SourceComponent } from '../../../src/resolve';
import { META_XML_SUFFIX } from '../../../src/common';

describe('DefaultSourceAdapter', () => {
  it('should return a SourceComponent when given a metadata xml file', () => {
    const type = mockRegistryData.types.matchingcontentfile;
    const path = join('path', 'to', type.directoryName, `My_Test.${type.suffix}${META_XML_SUFFIX}`);
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
    const type = mockRegistryData.types.matchingcontentfile;
    const path = join('path', 'to', type.directoryName, `My_Test.${type.suffix}`);
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
