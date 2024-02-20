/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { createSandbox } from 'sinon';
import chai = require('chai');
import deepEqualInAnyOrder = require('deep-equal-in-any-order');
import { WriterFormat } from '../../../src';
import { ConvertContext } from '../../../src/convert/convertContext/convertContext';
import { decomposed, matchingContentFile, nonDecomposed } from '../../mock';

const { expect } = chai;

chai.use(deepEqualInAnyOrder);

const env = createSandbox();

describe('Convert Transaction Constructs', () => {
  afterEach(() => env.restore());

  describe('ConvertContext', () => {
    it('should yield results of finalizers upon executeFinalizers', async () => {
      const context = new ConvertContext();
      const result1: WriterFormat[] = [{ component: matchingContentFile.COMPONENT, writeInfos: [] }];
      const result2: WriterFormat[] = [{ component: decomposed.DECOMPOSED_COMPONENT, writeInfos: [] }];
      const result3: WriterFormat[] = [{ component: nonDecomposed.COMPONENT_1, writeInfos: [] }];
      env.stub(context.recomposition, 'finalize').resolves(result1);
      env.stub(context.decomposition, 'finalize').resolves(result2);
      env.stub(context.nonDecomposition, 'finalize').resolves(result3);

      const results = [];
      for await (const result of context.executeFinalizers()) {
        results.push(...result);
      }

      const expected = [result1, result2, result3].reduce((x, y) => x.concat(y), []);

      expect(results).to.deep.equalInAnyOrder(expected);
    });
  });
});
