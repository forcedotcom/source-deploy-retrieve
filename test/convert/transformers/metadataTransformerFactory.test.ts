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

import { assert, expect } from 'chai';
import { Messages, SfError } from '@salesforce/core';
import { RegistryAccess, SourceComponent, registry } from '../../../src';
import { ConvertContext } from '../../../src/convert/convertContext/convertContext';
import { MetadataTransformerFactory } from '../../../src/convert/transformers/metadataTransformerFactory';
import { DecomposedMetadataTransformer } from '../../../src/convert/transformers/decomposedMetadataTransformer';
import { NonDecomposedMetadataTransformer } from '../../../src/convert/transformers/nonDecomposedMetadataTransformer';
import { DefaultMetadataTransformer } from '../../../src/convert/transformers/defaultMetadataTransformer';
import { StaticResourceMetadataTransformer } from '../../../src/convert/transformers/staticResourceMetadataTransformer';
import { matchingContentFile, mixedContentSingleFile } from '../../mock';
import { DECOMPOSED_COMPONENT } from '../../mock/type-constants/customObjectConstant';
import { COMPONENT_1 } from '../../mock/type-constants/customlabelsConstant';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/source-deploy-retrieve', 'sdr');

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
    const factory = new MetadataTransformerFactory(registryAccess, context);
    expect(factory.getTransformer(component)).to.deep.equal(new DecomposedMetadataTransformer(registryAccess, context));
  });

  it('should return NonDecomposedMetadataTransformer', () => {
    const component = COMPONENT_1;
    const context = new ConvertContext();
    const factory = new MetadataTransformerFactory(registryAccess, context);
    expect(factory.getTransformer(component)).to.deep.equal(
      new NonDecomposedMetadataTransformer(registryAccess, context)
    );
  });

  it('should return StaticResourceMetadataTransformer', () => {
    const component = mixedContentSingleFile.COMPONENT;
    const factory = new MetadataTransformerFactory(registryAccess);
    expect(factory.getTransformer(component)).to.deep.equal(new StaticResourceMetadataTransformer());
  });

  it('should return transformer that maps to parent type of a component', () => {
    const [child] = DECOMPOSED_COMPONENT.getChildren();
    const context = new ConvertContext();
    const factory = new MetadataTransformerFactory(registryAccess, context);
    expect(factory.getTransformer(child)).to.deep.equal(new DecomposedMetadataTransformer(registryAccess, context));
  });

  it('should throw an error for a missing transformer mapping', () => {
    const component = new SourceComponent({
      name: 'Test',
      type: {
        ...registry.types.apexclass,
        // @ts-ignore
        strategies: { adapter: 'matchingContentFile', transformer: 'MissingStrategies' },
      },
      xml: 'Test.xml',
    });
    const { type } = component;
    const factory = new MetadataTransformerFactory(registryAccess);
    assert.throws(
      () => factory.getTransformer(component),
      SfError,
      messages.getMessage('error_missing_transformer', [type.name, type.strategies?.transformer])
    );
  });
});
