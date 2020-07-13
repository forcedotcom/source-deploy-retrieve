/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { KEANU_COMPONENT } from '../../mock/registry/keanuConstants';
import { mockRegistry } from '../../mock/registry';
import { expect } from 'chai';
import { DefaultTransformer } from '../../../src/convert/transformers/default';
import { RegistryAccess } from '../../../src/metadata-registry';

describe('Metadata Transformers', () => {
  describe('getTransformer', () => {
    it('should return DefaultTransformer', () => {
      const component = KEANU_COMPONENT;
      const registryAccess = new RegistryAccess(mockRegistry);
      expect(registryAccess.getTransformer(component)).to.deep.equal(
        new DefaultTransformer(component)
      );
    });
  });

  require('./default');
});
