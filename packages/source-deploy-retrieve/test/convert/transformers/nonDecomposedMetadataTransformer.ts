/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { mockRegistry, mockRegistryData, nonDecomposed } from '../../mock/registry';
import { NonDecomposedMetadataTransformer } from '../../../src/convert/transformers/nonDecomposedMetadataTransformer';
import { expect } from 'chai';
import { createSandbox } from 'sinon';
import { ComponentSet, SourceComponent } from '../../../src';
import { ConvertContext } from '../../../src/convert/convertContext';

const env = createSandbox();

describe('NonDecomposedMetadataTransformer', () => {
  const component = nonDecomposed.COMPONENT_1;

  afterEach(() => env.restore());

  describe('toMetadataFormat', () => {
    it('should defer write operations and set context state', async () => {
      const [child1, child2] = component.getChildren();

      const context = new ConvertContext();
      const transformer = new NonDecomposedMetadataTransformer(mockRegistry, context);

      expect(await transformer.toMetadataFormat(child1)).to.deep.equal([]);
      expect(await transformer.toMetadataFormat(child2)).to.deep.equal([]);
      expect(context.recomposition.state).to.deep.equal({
        [component.fullName]: {
          component,
          children: new ComponentSet([child1, child2], mockRegistry),
        },
      });
    });
  });

  describe('toSourceFormat', () => {
    it('should defer write operations and set context state for unclaimed children', async () => {
      const context = new ConvertContext();
      const transformer = new NonDecomposedMetadataTransformer(mockRegistry, context);

      const result = await transformer.toSourceFormat(component);
      expect(result).to.deep.equal([]);
      expect(context.decomposition.state).to.deep.equal({});
      expect(context.recomposition.state).to.deep.equal({});
      expect(context.nonDecomposition.state).to.deep.equal({
        unclaimed: {
          [component.xml]: {
            parent: component,
            children: {
              [nonDecomposed.CHILD_1_NAME]: nonDecomposed.CHILD_1_XML,
              [nonDecomposed.CHILD_2_NAME]: nonDecomposed.CHILD_2_XML,
            },
          },
        },
        claimed: {},
      });
    });

    it('should defer write operations and set context state for claimed children', async () => {
      const context = new ConvertContext();
      const transformer = new NonDecomposedMetadataTransformer(mockRegistry, context);
      const componentToConvert = SourceComponent.createVirtualComponent(
        {
          name: component.type.name,
          type: mockRegistryData.types.nondecomposed,
          xml: component.xml,
        },
        []
      );
      env.stub(componentToConvert, 'parseXml').resolves(nonDecomposed.FULL_XML_CONTENT);
      env.stub(componentToConvert, 'parseXmlSync').returns(nonDecomposed.FULL_XML_CONTENT);

      const result = await transformer.toSourceFormat(componentToConvert, component);
      expect(result).to.deep.equal([]);
      expect(context.nonDecomposition.state).to.deep.equal({
        unclaimed: {
          [componentToConvert.xml]: {
            parent: componentToConvert,
            children: {
              [nonDecomposed.UNCLAIMED_CHILD_NAME]: nonDecomposed.UNCLAIMED_CHILD_XML,
              [nonDecomposed.CHILD_3_NAME]: nonDecomposed.CHILD_3_XML,
            },
          },
        },
        claimed: {
          [component.xml]: {
            parent: component,
            children: {
              [nonDecomposed.CHILD_1_NAME]: nonDecomposed.CHILD_1_XML,
              [nonDecomposed.CHILD_2_NAME]: nonDecomposed.CHILD_2_XML,
            },
          },
        },
      });
    });
  });
});
