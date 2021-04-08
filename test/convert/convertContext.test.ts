/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import deepEqualInAnyOrder = require('deep-equal-in-any-order');
import chai = require('chai');

chai.use(deepEqualInAnyOrder);

const { expect } = chai;
import { join } from 'path';
import { createSandbox, match } from 'sinon';
import { Readable } from 'stream';
import { SourceComponent } from '../../src';
import { ComponentSet } from '../../src/collections';
import {
  DEFAULT_PACKAGE_ROOT_SFDX,
  META_XML_SUFFIX,
  XML_NS_KEY,
  XML_NS_URL,
} from '../../src/common';
import { WriterFormat } from '../../src/convert';
import { ConvertContext } from '../../src/convert/convertContext';
import { JsToXml } from '../../src/convert/streams';
import { matchingContentFile, mockRegistry, regina, nonDecomposed } from '../mock/registry';

const env = createSandbox();

describe('Convert Transaction Constructs', () => {
  afterEach(() => env.restore());

  describe('ConvertContext', () => {
    it('should yield results of finalizers upon executeFinalizers', async () => {
      const context = new ConvertContext();
      const result1: WriterFormat[] = [
        { component: matchingContentFile.COMPONENT, writeInfos: [] },
      ];
      const result2: WriterFormat[] = [{ component: regina.REGINA_COMPONENT, writeInfos: [] }];
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

      it('should still recompose if parent xml is empty', async () => {
        const component = new SourceComponent(
          {
            name: regina.REGINA_COMPONENT.name,
            type: regina.REGINA_COMPONENT.type,
            content: regina.REGINA_COMPONENT.content,
          },
          regina.REGINA_COMPONENT.tree
        );
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

    describe('NonDecomposition', () => {
      it('should return WriterFormats for claimed children', async () => {
        const component = nonDecomposed.COMPONENT_1;
        const context = new ConvertContext();
        const writeInfos = [
          {
            output: component.xml,
            source: new JsToXml(nonDecomposed.COMPONENT_1_XML),
          },
        ];
        context.nonDecomposition.setState((state) => {
          state.claimed = {
            [component.xml]: {
              parent: component,
              children: {
                [nonDecomposed.CHILD_1_NAME]: nonDecomposed.CHILD_1_XML,
                [nonDecomposed.CHILD_2_NAME]: nonDecomposed.CHILD_2_XML,
              },
            },
          };
        });

        const result = await context.nonDecomposition.finalize(nonDecomposed.DEFAULT_DIR);

        expect(result).to.deep.equal([{ component, writeInfos }]);
      });

      it('should return WriterFormats for unclaimed children', async () => {
        const component = nonDecomposed.COMPONENT_1;
        const context = new ConvertContext();
        const [baseName] = component.fullName.split('.');
        const output = join(
          DEFAULT_PACKAGE_ROOT_SFDX,
          component.type.directoryName,
          `${baseName}.${component.type.suffix}${META_XML_SUFFIX}`
        );
        const writeInfos = [{ output, source: new JsToXml(nonDecomposed.COMPONENT_1_XML) }];
        context.nonDecomposition.setState((state) => {
          state.unclaimed = {
            [component.xml]: {
              parent: component,
              children: {
                [nonDecomposed.CHILD_1_NAME]: nonDecomposed.CHILD_1_XML,
                [nonDecomposed.CHILD_2_NAME]: nonDecomposed.CHILD_2_XML,
              },
            },
          };
        });

        const result = await context.nonDecomposition.finalize(nonDecomposed.DEFAULT_DIR);

        expect(result).to.deep.equal([{ component, writeInfos }]);
      });

      it('should add unclaimed children to default parent component', async () => {
        const component = nonDecomposed.COMPONENT_1;
        const unprocessedComponent = nonDecomposed.COMPONENT_2;

        env
          .stub(ComponentSet, 'fromSource')
          .withArgs({ fsPaths: [match(nonDecomposed.NON_DEFAULT_DIR)], include: match.any })
          .returns(new ComponentSet([unprocessedComponent]));

        const context = new ConvertContext();

        const writeInfos = [
          { output: component.xml, source: new JsToXml(nonDecomposed.FULL_XML_CONTENT) },
        ];
        context.nonDecomposition.setState((state) => {
          state.claimed = {
            [component.xml]: {
              parent: component,
              children: {
                [nonDecomposed.CHILD_1_NAME]: nonDecomposed.CHILD_1_XML,
                [nonDecomposed.CHILD_2_NAME]: nonDecomposed.CHILD_2_XML,
                [nonDecomposed.CHILD_3_NAME]: nonDecomposed.CHILD_3_XML,
              },
            },
          };
          state.unclaimed = {
            [component.xml]: {
              parent: component,
              children: {
                [nonDecomposed.UNCLAIMED_CHILD_NAME]: nonDecomposed.UNCLAIMED_CHILD_XML,
              },
            },
          };
        });

        const result = await context.nonDecomposition.finalize(nonDecomposed.DEFAULT_DIR);

        expect(result).to.deep.equal([{ component, writeInfos }]);
      });

      it('should find all unprocessed components so that unclaimed children can be claimed', async () => {
        const component = nonDecomposed.COMPONENT_1;
        const unprocessedComponent = nonDecomposed.COMPONENT_2;
        const context = new ConvertContext();

        env
          .stub(ComponentSet, 'fromSource')
          .withArgs({ fsPaths: [match(nonDecomposed.NON_DEFAULT_DIR)], include: match.any })
          .returns(new ComponentSet([unprocessedComponent]));

        const writeInfos = [
          { output: component.xml, source: new JsToXml(nonDecomposed.COMPONENT_1_XML) },
        ];
        context.nonDecomposition.setState((state) => {
          state.claimed = {
            [component.xml]: {
              parent: component,
              children: {
                [nonDecomposed.CHILD_1_NAME]: nonDecomposed.CHILD_1_XML,
                [nonDecomposed.CHILD_2_NAME]: nonDecomposed.CHILD_2_XML,
              },
            },
          };
          state.unclaimed = {
            [component.xml]: {
              parent: component,
              children: {
                [nonDecomposed.CHILD_3_NAME]: nonDecomposed.CHILD_3_XML,
              },
            },
          };
        });

        const result = await context.nonDecomposition.finalize(nonDecomposed.DEFAULT_DIR);
        expect(result).to.deep.equal([{ component, writeInfos }]);
      });
    });
  });
});
