/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { TestContext } from '@salesforce/core/testSetup';
import { nonDecomposed } from '../../mock';
import { NonDecomposedMetadataTransformer } from '../../../src/convert/transformers/nonDecomposedMetadataTransformer';
import { ComponentSet, registry, RegistryAccess, SourceComponent } from '../../../src';
import { ConvertContext } from '../../../src/convert/convertContext/convertContext';

describe('NonDecomposedMetadataTransformer', () => {
  const $$ = new TestContext();
  const component = nonDecomposed.COMPONENT_1;
  const registryAccess = new RegistryAccess();

  describe('toMetadataFormat', () => {
    it('should defer write operations and set context state', async () => {
      const [child1, child2] = component.getChildren();

      const context = new ConvertContext();
      const transformer = new NonDecomposedMetadataTransformer(registryAccess, context);

      expect(await transformer.toMetadataFormat(child1)).to.deep.equal([]);
      expect(await transformer.toMetadataFormat(child2)).to.deep.equal([]);

      expect(context.recomposition.transactionState.size).to.equal(1);
      expect(context.recomposition.transactionState.get(component.fullName)).to.deep.equal({
        component,
        children: new ComponentSet([child1, child2]),
      });
    });
  });

  describe('toSourceFormat', () => {
    it('should defer write operations and set context state for unclaimed children', async () => {
      const context = new ConvertContext();
      const transformer = new NonDecomposedMetadataTransformer(registryAccess, context);

      const result = await transformer.toSourceFormat({ component });
      expect(result).to.deep.equal([]);
      expect(context.decomposition.transactionState).to.deep.equal(new Map());
      expect(context.recomposition.transactionState).to.deep.equal(new Map());

      expect(context.nonDecomposition.transactionState).to.deep.equal({
        childrenByUniqueElement: new Map([
          [nonDecomposed.CHILD_1_NAME, nonDecomposed.CHILD_1_XML],
          [nonDecomposed.CHILD_2_NAME, nonDecomposed.CHILD_2_XML],
        ]),
        exampleComponent: component,
      });
    });

    it('should defer write operations and set context state for claimed children', async () => {
      const context = new ConvertContext();
      const transformer = new NonDecomposedMetadataTransformer(registryAccess, context);
      const componentToConvert = SourceComponent.createVirtualComponent(
        {
          name: component.type.name,
          type: registry.types.customlabels,
          xml: component.xml,
        },
        []
      );
      $$.SANDBOX.stub(componentToConvert, 'parseXml').resolves(nonDecomposed.FULL_XML_CONTENT);
      $$.SANDBOX.stub(componentToConvert, 'parseXmlSync').returns(nonDecomposed.FULL_XML_CONTENT);

      const result = await transformer.toSourceFormat({ component: componentToConvert, mergeWith: component });
      expect(result).to.deep.equal([]);
      expect(context.nonDecomposition.transactionState).to.deep.equal({
        childrenByUniqueElement: new Map([
          [nonDecomposed.CHILD_1_NAME, nonDecomposed.CHILD_1_XML],
          [nonDecomposed.CHILD_2_NAME, nonDecomposed.CHILD_2_XML],
          [nonDecomposed.UNCLAIMED_CHILD_NAME, nonDecomposed.UNCLAIMED_CHILD_XML],
          [nonDecomposed.CHILD_3_NAME, nonDecomposed.CHILD_3_XML],
        ]),
        exampleComponent: componentToConvert,
      });
    });
  });
});
