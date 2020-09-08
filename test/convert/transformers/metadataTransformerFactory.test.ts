/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { KEANU_COMPONENT } from '../../mock/registry/keanuConstants';
import { mockRegistry } from '../../mock/registry';
import { expect } from 'chai';
import { DefaultMetadataTransformer } from '../../../src/convert/transformers/defaultMetadataTransformer';
import { MetadataTransformerFactory } from '../../../src/convert/transformers';
import { DecomposedMetadataTransformer } from '../../../src/convert/transformers/decomposedMetadataTransformer';
import { REGINA_COMPONENT } from '../../mock/registry/reginaConstants';
import { ConvertTransaction } from '../../../src/convert/convertTransaction';
import { MC_SINGLE_FILE_COMPONENT } from '../../mock/registry/mixedContentSingleFileConstants';
import { StaticResourceMetadataTransformer } from '../../../src/convert/transformers/staticResourceMetadataTransformer';

describe('MetadataTransformerFactory', () => {
  it('should return DefaultMetadataTransformer', () => {
    const component = KEANU_COMPONENT;
    const factory = new MetadataTransformerFactory(mockRegistry);
    expect(factory.getTransformer(component)).to.deep.equal(
      new DefaultMetadataTransformer(component)
    );
  });

  it('should return DecomposedMetadataTransformer', () => {
    const component = REGINA_COMPONENT;
    const transaction = new ConvertTransaction();
    const factory = new MetadataTransformerFactory(mockRegistry, transaction);
    expect(factory.getTransformer(component)).to.deep.equal(
      new DecomposedMetadataTransformer(component, transaction)
    );
  });

  it('should return StaticResourceMetadataTransformer', () => {
    const component = MC_SINGLE_FILE_COMPONENT;
    const factory = new MetadataTransformerFactory(mockRegistry);
    expect(factory.getTransformer(component)).to.deep.equal(
      new StaticResourceMetadataTransformer(component)
    );
  });
});
