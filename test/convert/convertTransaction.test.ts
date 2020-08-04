/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ConvertTransaction } from '../../src/convert/convertTransaction';
import { keanu, regina } from '../mock/registry';
import { expect } from 'chai';
import { createSandbox } from 'sinon';
import { TestFinalizerNoWrites, TestFinalizerNoResult } from '../mock/convert/finalizers';

const env = createSandbox();

describe('Convert Transaction Constructs', () => {
  describe('ConvertTransaction', () => {
    it('should only set a finalizer once per transaction', () => {
      const transaction = new ConvertTransaction();

      // @ts-ignore visible for testing
      const setSpy = env.spy(transaction.finalizers, 'set');
      transaction.addFinalizer(TestFinalizerNoWrites);
      transaction.addFinalizer(TestFinalizerNoWrites);

      expect(setSpy.calledOnce).to.be.true;

      env.restore();
    });

    it('should yield results of finalizers upon executeFinalizers', () => {
      const transaction = new ConvertTransaction();

      transaction.addFinalizer(TestFinalizerNoWrites);
      transaction.addFinalizer(TestFinalizerNoResult);
      const results = Array.from(transaction.executeFinalizers());

      expect(results).to.deep.equal([
        {
          component: keanu.KEANU_COMPONENT,
          writeInfos: [],
        },
        undefined,
      ]);
    });
  });

  // describe('RecompositionFinalizer', () => {
  //   it('should return a WriterFormat for each parent component', () => {
  //     const component = regina.REGINA_COMPONENT;
  //     const children = component.getChildren();
  //     const finalizer = new RecompositionFinalizer();
  //     const state: ConvertTransactionState = {
  //       recompose: {
  //         Test__c: {
  //           component,
  //           children,
  //         },
  //       },
  //     };

  //     const result = finalizer.finalize(state);
  //   });
  // });
});
