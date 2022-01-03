/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { RegistryAccess } from '../../../src';
import { ConvertContext } from '../../../src/convert/convertContext';
import { MetadataTransformerFactory } from '../../../src/convert/transformers';
import { DecomposedMetadataTransformer } from '../../../src/convert/transformers/decomposedMetadataTransformer';
import { NonDecomposedMetadataTransformer } from '../../../src/convert/transformers/nonDecomposedMetadataTransformer';
import { DefaultMetadataTransformer } from '../../../src/convert/transformers/defaultMetadataTransformer';
import { StaticResourceMetadataTransformer } from '../../../src/convert/transformers/staticResourceMetadataTransformer';
import { matchingContentFile, mixedContentSingleFile } from '../../mock/registry';
import { DECOMPOSED_COMPONENT } from '../../mock/registry/type-constants/decomposedConstants';
import { COMPONENT_1 } from '../../mock/registry/type-constants/nonDecomposedConstants';

const registryAccess = new RegistryAccess();

describe('MetadataTransformerFactory', () => {
  it('should return DefaultMetadataTransformer', () => {
    const component = matchingContentFile.COMPONENT;
    const factory = new MetadataTransformerFactory(registryAccess);
    expect(factory.getTransformer(component)).to.deep.equal(new DefaultMetadataTransformer());
  });

  it('should return DecomposedMetadataTransformer', () => {
    const component = DECOMPOSED_COMPONENT;
    const context = new ConvertContext();
    const factory = new MetadataTransformerFactory(undefined, context);
    expect(factory.getTransformer(component)).to.deep.equal(new DecomposedMetadataTransformer(undefined, context));
  });

  it('should return NonDecomposedMetadataTransformer', () => {
    const component = COMPONENT_1;
    const context = new ConvertContext();
    const factory = new MetadataTransformerFactory(undefined, context);
    expect(factory.getTransformer(component)).to.deep.equal(new NonDecomposedMetadataTransformer(undefined, context));
  });

  it('should return StaticResourceMetadataTransformer', () => {
    const component = mixedContentSingleFile.COMPONENT;
    const factory = new MetadataTransformerFactory(registryAccess);
    expect(factory.getTransformer(component)).to.deep.equal(new StaticResourceMetadataTransformer());
  });

  it('should return transformer that maps to parent type of a component', () => {
    const [child] = DECOMPOSED_COMPONENT.getChildren();
    const context = new ConvertContext();
    const factory = new MetadataTransformerFactory(undefined, context);
    expect(factory.getTransformer(child)).to.deep.equal(new DecomposedMetadataTransformer(undefined, context));
  });
});
