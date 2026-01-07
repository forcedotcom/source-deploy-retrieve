/*
 * Copyright 2026, Salesforce, Inc.
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

import { createSandbox } from 'sinon';
import * as chai from 'chai';
import deepEqualInAnyOrder from 'deep-equal-in-any-order';
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
