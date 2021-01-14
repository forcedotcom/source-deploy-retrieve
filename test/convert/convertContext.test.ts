/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { join } from 'path';
import { createSandbox } from 'sinon';
import { Readable } from 'stream';
import { ComponentSet } from '../../src/collections';
import { XML_NS_KEY, XML_NS_URL } from '../../src/common';
import { WriterFormat } from '../../src/convert';
import { ConvertContext } from '../../src/convert/convertContext';
import { JsToXml } from '../../src/convert/streams';
import { keanu, mockRegistry, regina } from '../mock/registry';

const env = createSandbox();

describe('Convert Transaction Constructs', () => {
  afterEach(() => env.restore());

  describe('ConvertContext', () => {
    it('should yield results of finalizers upon executeFinalizers', async () => {
      const context = new ConvertContext();
      const result1: WriterFormat[] = [
        {
          component: keanu.KEANU_COMPONENT,
          writeInfos: [],
        },
      ];
      const result2: WriterFormat[] = [
        {
          component: regina.REGINA_COMPONENT,
          writeInfos: [],
        },
      ];
      env.stub(context.recomposition, 'finalize').resolves(result1);
      env.stub(context.decomposition, 'finalize').resolves(result2);

      const results = [];
      for await (const result of context.executeFinalizers()) {
        results.push(...result);
      }

      expect(results).to.deep.equal(result2.concat(result1));
    });

    describe('Recomposition', () => {
      it('should return a WriterFormat with recomposed data', async () => {
        const component = regina.REGINA_COMPONENT;
        const context = new ConvertContext();
        context.recomposition.setState((state) => {
          state['Test__c'] = {
            component,
            children: new ComponentSet(component.getChildren(), mockRegistry),
          };
        });

        const result = await context.recomposition.finalize();

        expect(result).to.deep.equal([
          {
            component,
            writeInfos: [
              {
                source: new JsToXml({
                  ReginaKing: {
                    [XML_NS_KEY]: XML_NS_URL,
                    fullName: 'a',
                    ys: [{ test: 'child1' }],
                    xs: [{ test: 'child2' }],
                  },
                }),
                output: join('reginas', 'a.regina'),
              },
            ],
          },
        ]);
      });
    });

    describe('Decomposition', () => {
      it('should return WriterFormats only for components where a merge was not found', async () => {
        const component = regina.REGINA_COMPONENT;
        const context = new ConvertContext();
        const children = component.getChildren();
        const writeInfos = [
          {
            output: 'test',
            source: new Readable(),
          },
          {
            output: 'test2',
            source: new Readable(),
          },
        ];
        context.decomposition.setState((state) => {
          state[children[0].fullName] = {
            origin: component,
            foundMerge: true,
            writeInfo: writeInfos[0],
          };
          state[children[1].fullName] = {
            origin: component,
            foundMerge: false,
            writeInfo: writeInfos[1],
          };
        });

        const result = await context.decomposition.finalize();

        expect(result).to.deep.equal([
          {
            component,
            writeInfos: [writeInfos[1]],
          },
        ]);
      });
    });
  });
});
