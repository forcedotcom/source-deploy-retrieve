/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { assert, expect } from 'chai';
import { ConvertContext } from '../../../src/convert/convertContext';
import { MetadataTransformerFactory } from '../../../src/convert/transformers';
import { DecomposedMetadataTransformer } from '../../../src/convert/transformers/decomposedMetadataTransformer';
import { DefaultMetadataTransformer } from '../../../src/convert/transformers/defaultMetadataTransformer';
import { StaticResourceMetadataTransformer } from '../../../src/convert/transformers/staticResourceMetadataTransformer';
import { RegistryError } from '../../../src/errors';
import { nls } from '../../../src/i18n';
import { mockRegistry } from '../../mock/registry';
import { GENE_COMPONENT } from '../../mock/registry/geneConstants';
import { COMPONENT } from '../../mock/registry/matchingContentFileConstants';
import { MC_SINGLE_FILE_COMPONENT } from '../../mock/registry/mixedContentSingleFileConstants';
import { REGINA_COMPONENT } from '../../mock/registry/reginaConstants';

describe('MetadataTransformerFactory', () => {
  it('should return DefaultMetadataTransformer', () => {
    const component = COMPONENT;
    const factory = new MetadataTransformerFactory(mockRegistry);
    expect(factory.getTransformer(component)).to.deep.equal(
      new DefaultMetadataTransformer(mockRegistry)
    );
  });

  it('should return DecomposedMetadataTransformer', () => {
    const component = REGINA_COMPONENT;
    const context = new ConvertContext();
    const factory = new MetadataTransformerFactory(mockRegistry, context);
    expect(factory.getTransformer(component)).to.deep.equal(
      new DecomposedMetadataTransformer(mockRegistry, context)
    );
  });

  it('should return StaticResourceMetadataTransformer', () => {
    const component = MC_SINGLE_FILE_COMPONENT;
    const factory = new MetadataTransformerFactory(mockRegistry);
    expect(factory.getTransformer(component)).to.deep.equal(
      new StaticResourceMetadataTransformer(mockRegistry)
    );
  });

  it('should return transformer that maps to parent type of a component', () => {
    const [child] = REGINA_COMPONENT.getChildren();
    const context = new ConvertContext();
    const factory = new MetadataTransformerFactory(mockRegistry, context);
    expect(factory.getTransformer(child)).to.deep.equal(
      new DecomposedMetadataTransformer(mockRegistry, context)
    );
  });

  it('should throw an error for a missing transformer mapping', () => {
    const component = GENE_COMPONENT;
    const { type } = component;
    const factory = new MetadataTransformerFactory(mockRegistry);
    assert.throws(
      () => factory.getTransformer(component),
      RegistryError,
      nls.localize('error_missing_transformer', [type.name, type.strategies.transformer])
    );
  });
});
