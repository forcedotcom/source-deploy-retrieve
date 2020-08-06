/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  ConvertTransaction,
  RecompositionFinalizer,
  ConvertTransactionState,
} from '../../src/convert/convertTransaction';
import { keanu, regina } from '../mock/registry';
import { expect } from 'chai';
import { createSandbox } from 'sinon';
import { TestFinalizerNoWrites, TestFinalizerNoResult } from '../mock/convert/finalizers';
import { Readable } from 'stream';
import { join } from 'path';
import * as fs from 'fs';
import { XML_NS, XML_DECL } from '../../src/utils/constants';

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

  describe('RecompositionFinalizer', () => {
    it('should return a WriterFormat with recomposed data', () => {
      const component = regina.REGINA_COMPONENT;
      const children = component.getChildren();
      const readStub = env.stub(fs, 'readFileSync');
      readStub.withArgs(children[0].xml).returns('<Y><test>child1</test></Y>');
      readStub.withArgs(children[1].xml).returns('<X><test>child2</test></X>');
      const finalizer = new RecompositionFinalizer();
      const state: ConvertTransactionState = {
        recompose: {
          Test__c: {
            component,
            children,
          },
        },
      };

      const result = finalizer.finalize(state);

      const expectedStr = `${XML_DECL}<ReginaKing xmlns="${XML_NS}">\n  <ys>\n    <test>child1</test>\n  </ys>\n  <xs>\n    <test>child2</test>\n  </xs>\n</ReginaKing>\n`;
      const source = new Readable();
      source.push(expectedStr);
      source.push(null);

      expect(result).to.deep.equal([
        {
          component: component,
          writeInfos: [
            {
              relativeDestination: join('reginas', 'a.regina'),
              source,
            },
          ],
        },
      ]);
    });
  });
});
