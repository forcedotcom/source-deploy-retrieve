/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect } from 'chai';
import { join } from 'path';
import { createSandbox } from 'sinon';
import {
  ConvertTransaction,
  RecompositionFinalizer,
  ConvertTransactionState,
} from '../../src/convert/convertTransaction';
import { JsToXml } from '../../src/convert/streams';
import { keanu, regina } from '../mock/registry';
import { TestFinalizerNoWrites, TestFinalizerNoResult } from '../mock/convert/finalizers';
import { XML_NS_URL, XML_NS_KEY } from '../../src/common';

const env = createSandbox();

describe('Convert Transaction Constructs', () => {
  afterEach(() => env.restore());
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

    it('should yield results of finalizers upon executeFinalizers', async () => {
      const transaction = new ConvertTransaction();

      transaction.addFinalizer(TestFinalizerNoWrites);
      transaction.addFinalizer(TestFinalizerNoResult);
      const results = [];
      for await (const result of transaction.executeFinalizers()) {
        results.push(Array.isArray(result) ? result : result);
      }

      expect(results).to.deep.equal([
        {
          component: keanu.KEANU_COMPONENT,
          writeInfos: [],
        },
        undefined,
      ]);
    });
  });

  describe('RecompositionFinalizer', () => {
    it('should return a WriterFormat with recomposed data', async () => {
      const component = regina.REGINA_COMPONENT;
      const children = component.getChildren();
      const readStub = env.stub(component.tree, 'readFile');
      readStub.withArgs(children[0].xml).resolves(Buffer.from('<Y><test>child1</test></Y>'));
      readStub.withArgs(children[1].xml).resolves(Buffer.from('<X><test>child2</test></X>'));
      const finalizer = new RecompositionFinalizer();
      const state: ConvertTransactionState = {
        recompose: {
          Test__c: {
            component,
            children,
          },
        },
      };

      const result = await finalizer.finalize(state);

      expect(result).to.deep.equal([
        {
          component: component,
          writeInfos: [
            {
              source: new JsToXml({
                ReginaKing: {
                  [XML_NS_KEY]: XML_NS_URL,
                  ys: [{ test: 'child1' }],
                  xs: [{ test: 'child2' }],
                },
              }),
              relativeDestination: join('reginas', 'a.regina'),
            },
          ],
        },
      ]);
    });
  });
});
