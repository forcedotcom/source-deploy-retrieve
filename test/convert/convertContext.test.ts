/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Readable } from 'node:stream';
import { join } from 'node:path';

import { SfProject } from '@salesforce/core';
import { createSandbox } from 'sinon';
import chai = require('chai');
import deepEqualInAnyOrder = require('deep-equal-in-any-order');
import {
  ComponentSet,
  RegistryAccess,
  SourceComponent,
  VirtualDirectory,
  VirtualTreeContainer,
  WriterFormat,
} from '../../src';
import { META_XML_SUFFIX, XML_NS_KEY, XML_NS_URL } from '../../src/common';
import { ConvertContext } from '../../src/convert/convertContext';
import { JsToXml } from '../../src/convert/streams';
import { decomposed, matchingContentFile, nonDecomposed } from '../mock';
import {
  CHILD_1_XML,
  CHILD_2_XML,
  DEFAULT_DIR,
  NON_DEFAULT_DIR,
  TREE,
  VIRTUAL_DIR,
  WORKING_DIR,
} from '../mock/type-constants/customlabelsConstant';

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

    describe('Recomposition', () => {
      it('should return a WriterFormat with recomposed data and remove XML_NS_KEY from child components', async () => {
        const component = decomposed.DECOMPOSED_COMPONENT;
        const context = new ConvertContext();
        context.recomposition.transactionState.set('Test__c', {
          component,
          children: new ComponentSet(component.getChildren()),
        });

        const readFileSpy = env.spy(component.tree, 'readFile');

        const result = await context.recomposition.finalize();

        expect(result).to.deep.equal([
          {
            component,
            writeInfos: [
              {
                source: new JsToXml({
                  CustomObject: {
                    [XML_NS_KEY]: XML_NS_URL,
                    fullName: 'customObject__c',
                    validationRules: [{ fullName: 'child2' }],
                    fields: [{ fullName: 'child1' }],
                  },
                }),
                output: join('objects', 'customObject__c.object'),
              },
            ],
          },
        ]);
        expect(readFileSpy.callCount).to.equal(3);
      });

      it('should still recompose if parent xml is empty', async () => {
        const component = new SourceComponent(
          {
            name: decomposed.DECOMPOSED_COMPONENT.name,
            type: decomposed.DECOMPOSED_COMPONENT.type,
            content: decomposed.DECOMPOSED_COMPONENT.content,
          },
          decomposed.DECOMPOSED_COMPONENT.tree
        );
        const context = new ConvertContext();
        context.recomposition.transactionState.set('Test__c', {
          component,
          children: new ComponentSet(component.getChildren()),
        });

        const result = await context.recomposition.finalize();

        expect(result).to.deep.equal([
          {
            component,
            writeInfos: [
              {
                source: new JsToXml({
                  CustomObject: {
                    [XML_NS_KEY]: XML_NS_URL,
                    validationRules: [{ fullName: 'child2' }],
                    fields: [{ fullName: 'child1' }],
                  },
                }),
                output: join('objects', 'customObject__c.object'),
              },
            ],
          },
        ]);
      });

      it('should only read parent xml file once for non-decomposed components with children', async () => {
        const component = nonDecomposed.COMPONENT_1;
        const context = new ConvertContext();
        context.recomposition.transactionState.set(component.type.name, {
          component,
          children: new ComponentSet(component.getChildren()),
        });

        const readFileSpy = env.spy(component.tree, 'readFile');

        const result = await context.recomposition.finalize();
        expect(result).to.deep.equal([
          {
            component,
            writeInfos: [
              {
                source: new JsToXml({
                  CustomLabels: {
                    [XML_NS_KEY]: XML_NS_URL,
                    labels: [CHILD_1_XML, CHILD_2_XML],
                  },
                }),
                output: join('labels', 'CustomLabels.labels'),
              },
            ],
          },
        ]);

        expect(readFileSpy.callCount).to.equal(1);
      });

      it('should only read unique child xml files once for non-decomposed components', async () => {
        // This test sets up 2 CustomLabels files; 1 in each package directory. The CustomLabels files
        // each have 2 labels within them. This should result in only 2 file reads.
        const customLabelsType = new RegistryAccess().getTypeByName('CustomLabels');
        const labelsFileName = 'CustomLabels.labels-meta.xml';
        const projectDir = join(process.cwd(), 'my-project');
        const packageDir1 = join(projectDir, 'pkgDir1');
        const packageDir2 = join(projectDir, 'pkgDir2');
        const dir1Labels = join(packageDir1, 'labels');
        const dir2Labels = join(packageDir2, 'labels');
        const parentXmlPath1 = join(dir1Labels, labelsFileName);
        const parentXmlPath2 = join(dir2Labels, labelsFileName);
        const labelXmls = [1, 2, 3, 4].map((i) => ({
          fullName: `Child_${i}`,
          description: `child ${i} desc`,
        }));
        const labelsXmls = [0, 2].map((i) => ({
          [customLabelsType.name]: {
            [XML_NS_KEY]: XML_NS_URL,
            [customLabelsType.directoryName]: [labelXmls[i], labelXmls[i + 1]],
          },
        }));
        const vDir: VirtualDirectory[] = [
          { dirPath: projectDir, children: ['pkgDir1', 'pkgDir2'] },
          { dirPath: packageDir1, children: ['labels'] },
          { dirPath: packageDir2, children: ['labels'] },
          {
            dirPath: dir1Labels,
            children: [
              {
                name: labelsFileName,
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                data: Buffer.from(new JsToXml(labelsXmls[0]).read().toString()),
              },
            ],
          },
          {
            dirPath: dir2Labels,
            children: [
              {
                name: labelsFileName,
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                data: Buffer.from(new JsToXml(labelsXmls[1]).read().toString()),
              },
            ],
          },
        ];
        const component = new SourceComponent(
          { name: customLabelsType.name, type: customLabelsType, xml: parentXmlPath1 },
          new VirtualTreeContainer(vDir)
        );
        const component2 = new SourceComponent(
          { name: customLabelsType.name, type: customLabelsType, xml: parentXmlPath2 },
          new VirtualTreeContainer(vDir)
        );
        const context = new ConvertContext();
        const compSet = new ComponentSet();
        component.getChildren().forEach((child) => compSet.add(child));
        component2.getChildren().forEach((child) => compSet.add(child));
        context.recomposition.transactionState.set(component.type.name, {
          component,
          children: compSet,
        });

        const readFileSpy = env.spy(component.tree, 'readFile');

        await context.recomposition.finalize();

        expect(readFileSpy.callCount).to.equal(2);
      });
    });

    describe('Decomposition', () => {
      it('should return WriterFormats only for components where a merge was not found', async () => {
        const component = decomposed.DECOMPOSED_COMPONENT;
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
        context.decomposition.transactionState.set(children[0].fullName, {
          origin: component,
          foundMerge: true,
          writeInfo: writeInfos[0],
        });

        context.decomposition.transactionState
          .set(children[0].fullName, {
            origin: component,
            foundMerge: true,
            writeInfo: writeInfos[0],
          })
          .set(children[1].fullName, {
            origin: component,
            foundMerge: false,
            writeInfo: writeInfos[1],
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
      let sfProjectStub: sinon.SinonStub;
      beforeEach(() => {
        sfProjectStub = env.stub(SfProject, 'getInstance').returns({
          getPackageDirectories: () => [
            {
              name: 'force-app',
              path: 'force-app',
              fullPath: nonDecomposed.DEFAULT_DIR,
            },
          ],
        } as unknown as SfProject);
      });
      it('should return WriterFormats for claimed children', async () => {
        const component = nonDecomposed.COMPONENT_1;
        const context = new ConvertContext();
        const writeInfos = [
          {
            output: component.xml,
            source: new JsToXml(nonDecomposed.COMPONENT_1_XML),
          },
        ];
        context.nonDecomposition.transactionState = {
          childrenByUniqueElement: new Map([
            [nonDecomposed.CHILD_1_NAME, nonDecomposed.CHILD_1_XML],
            [nonDecomposed.CHILD_2_NAME, nonDecomposed.CHILD_2_XML],
          ]),
          exampleComponent: component,
        };

        const result = await context.nonDecomposition.finalize(nonDecomposed.DEFAULT_DIR, TREE);
        expect(result).to.deep.equal([{ component, writeInfos }]);
      });

      it('should return WriterFormats when no local files exist', async () => {
        const component = nonDecomposed.COMPONENT_1;
        const context = new ConvertContext();
        const [baseName] = component.fullName.split('.');
        const output = join(
          nonDecomposed.DEFAULT_DIR,
          'main',
          'default',
          component.type.directoryName,
          `${baseName}.${component.type.suffix}${META_XML_SUFFIX}`
        );
        const writeInfos = [{ output, source: new JsToXml(nonDecomposed.COMPONENT_1_XML) }];
        context.nonDecomposition.transactionState = {
          childrenByUniqueElement: new Map([
            [nonDecomposed.CHILD_1_NAME, nonDecomposed.CHILD_1_XML],
            [nonDecomposed.CHILD_2_NAME, nonDecomposed.CHILD_2_XML],
          ]),
          exampleComponent: component,
        };

        const result = await context.nonDecomposition.finalize(
          nonDecomposed.DEFAULT_DIR,
          new VirtualTreeContainer(
            // leave the 2 pkgDirs empty
            VIRTUAL_DIR.filter((item) => [WORKING_DIR, DEFAULT_DIR, NON_DEFAULT_DIR].includes(item.dirPath)).map(
              (item) => ([DEFAULT_DIR, NON_DEFAULT_DIR].includes(item.dirPath) ? { ...item, children: [] } : item)
            )
          )
        );

        expect(result).to.deep.equal([{ component, writeInfos }]);
      });

      it('should merge unclaimed children to default parent component', async () => {
        const component = nonDecomposed.COMPONENT_1;
        const type = component.type;
        const context = new ConvertContext();

        const defaultPlusUnclaimed = {
          [type.name]: {
            [XML_NS_KEY]: XML_NS_URL,
            [type.directoryName]: [
              nonDecomposed.CHILD_1_XML,
              nonDecomposed.CHILD_2_XML,
              nonDecomposed.UNCLAIMED_CHILD_XML,
            ],
          },
        };
        const writeInfos = [{ output: component.xml, source: new JsToXml(defaultPlusUnclaimed) }];
        context.nonDecomposition.transactionState = {
          childrenByUniqueElement: new Map([
            [nonDecomposed.CHILD_1_NAME, nonDecomposed.CHILD_1_XML],
            [nonDecomposed.CHILD_2_NAME, nonDecomposed.CHILD_2_XML],
            [nonDecomposed.UNCLAIMED_CHILD_NAME, nonDecomposed.UNCLAIMED_CHILD_XML],
          ]),
          exampleComponent: component,
        };

        const result = await context.nonDecomposition.finalize(nonDecomposed.DEFAULT_DIR, TREE);

        expect(result).to.deep.equal([{ component, writeInfos }]);
      });

      it('should merge 1 updated file', async () => {
        const component = nonDecomposed.COMPONENT_1;
        const context = new ConvertContext();
        const type = component.type;

        // change the word first to 'updated'
        const updatedChild1Xml = {
          ...nonDecomposed.CHILD_1_XML,
          value: nonDecomposed.CHILD_1_XML.value.replace('first', 'updated'),
        };

        const updatedFullXml = {
          [type.name]: {
            [XML_NS_KEY]: XML_NS_URL,
            [type.directoryName]: [updatedChild1Xml, CHILD_2_XML],
          },
        };

        const writeInfos = [{ output: component.xml, source: new JsToXml(updatedFullXml) }];
        context.nonDecomposition.transactionState = {
          childrenByUniqueElement: new Map([[nonDecomposed.CHILD_1_NAME, updatedChild1Xml]]),
          exampleComponent: component,
        };

        const result = await context.nonDecomposition.finalize(nonDecomposed.DEFAULT_DIR, TREE);
        expect(result).to.deep.equal([{ component, writeInfos }]);
      });

      it('should merge 1 updated file to non-default dir and not write default file', async () => {
        sfProjectStub.restore();
        env.stub(SfProject, 'getInstance').returns({
          getPackageDirectories: () => [
            {
              name: 'my-app',
              path: 'my-app',
              fullPath: nonDecomposed.NON_DEFAULT_DIR,
            },
            {
              name: 'force-app',
              path: 'force-app',
              fullPath: nonDecomposed.DEFAULT_DIR,
            },
          ],
        } as unknown as SfProject);
        const component = nonDecomposed.COMPONENT_2;
        const context = new ConvertContext();
        const type = component.type;

        // change the word 'third' to 'updated'
        const updatedChild3Xml = {
          ...nonDecomposed.CHILD_3_XML,
          value: nonDecomposed.CHILD_3_XML.value.replace('third', 'updated'),
        };

        const updatedFullXml = {
          [type.name]: {
            [XML_NS_KEY]: XML_NS_URL,
            [type.directoryName]: [updatedChild3Xml],
          },
        };

        const writeInfos = [{ output: component.xml, source: new JsToXml(updatedFullXml) }];
        context.nonDecomposition.transactionState = {
          childrenByUniqueElement: new Map([[nonDecomposed.CHILD_3_NAME, updatedChild3Xml]]),
          exampleComponent: component,
        };

        const result = await context.nonDecomposition.finalize(nonDecomposed.DEFAULT_DIR, TREE);
        expect(result).to.deep.equal([{ component, writeInfos }]);
      });
    });
  });
});
