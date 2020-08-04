/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { regina } from '../../mock/registry';
<<<<<<< HEAD
import { DecomposedMetadataTransformer } from '../../../src/convert/transformers/decomposedMetadataTransformer';
=======
import { DecomposedMetadataTransformer } from '../../../src/convert/transformers/DecomposedMetadataTransformer';
>>>>>>> more tests
import {
  ConvertTransaction,
  RecompositionFinalizer,
} from '../../../src/convert/convertTransaction';
import { expect } from 'chai';
import { spy } from 'sinon';

describe('DecomposedMetadataTransformer', () => {
  const component = regina.REGINA_COMPONENT;

  it('should register RecompositionFinalizer', () => {
    const transaction = new ConvertTransaction();
    const addFinalizerSpy = spy(transaction, 'addFinalizer');

    new DecomposedMetadataTransformer(component, transaction);
    const finalizerRegistered = addFinalizerSpy.calledWith(RecompositionFinalizer);
    addFinalizerSpy.restore();

    expect(finalizerRegistered).to.be.true;
  });

  describe('toMetadataFormat', () => {
    it('should delay for partial recomposition when a child component is given', () => {
      const child = component.getChildren()[0];
      const transaction = new ConvertTransaction();
      const transformer = new DecomposedMetadataTransformer(child, transaction);

      const writerFormat = transformer.toMetadataFormat();

      expect(writerFormat).to.deep.equal({ component: child, writeInfos: [] });
      expect(transaction.state).to.deep.equal({
        recompose: {
          [component.fullName]: {
            component,
            children: [child],
          },
        },
      });
    });

    // it('should fully recompose metadata when a parent component is given', () => {});
  });
});
