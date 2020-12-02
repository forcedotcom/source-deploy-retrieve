/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { mockRegistry, mockRegistryData, regina } from '../../mock/registry';
import { DecomposedMetadataTransformer } from '../../../src/convert/transformers/decomposedMetadataTransformer';
import {
  ConvertTransaction,
  RecompositionFinalizer,
} from '../../../src/convert/convertTransaction';
import { expect } from 'chai';
import { createSandbox } from 'sinon';
import { join } from 'path';
import { JsToXml } from '../../../src/convert/streams';
import { DECOMPOSED_TOP_LEVEL_COMPONENT } from '../../mock/registry/decomposedTopLevelConstants';
import { SourceComponent } from '../../../src';
import { XML_NS_URL, XML_NS_KEY } from '../../../src/common';

const env = createSandbox();

describe('DecomposedMetadataTransformer', () => {
  const component = regina.REGINA_COMPONENT;
  const composedXmlObj = {
    ReginaKing: {
      [XML_NS_KEY]: XML_NS_URL,
      fullName: component.fullName,
      foo: 'bar',
      ys: [{ fullName: 'child', test: 'testVal' }],
      xs: [{ fullName: 'child2', test: 'testVal2' }],
    },
  };

  afterEach(() => env.restore());

  it('should register RecompositionFinalizer', () => {
    const transaction = new ConvertTransaction();
    const addFinalizerSpy = env.spy(transaction, 'addFinalizer');

    new DecomposedMetadataTransformer(mockRegistry, transaction);

    expect(addFinalizerSpy.calledWith(RecompositionFinalizer)).to.be.true;
  });

  describe('toMetadataFormat', () => {
    it('should delay for partial recomposition when a child component is given', async () => {
      const child = component.getChildren()[0];
      const transaction = new ConvertTransaction();
      const transformer = new DecomposedMetadataTransformer(mockRegistry, transaction);

      const writerFormat = await transformer.toMetadataFormat(child);

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

    it('should fully recompose metadata when a parent component is given', async () => {
      const transformer = new DecomposedMetadataTransformer(mockRegistry, new ConvertTransaction());
      const children = component.getChildren();
      env.stub(component, 'parseXml').resolves({
        ReginaKing: {
          [XML_NS_KEY]: XML_NS_URL,
          fullName: component.fullName,
          foo: 'bar',
        },
      });
      env.stub(children[0], 'parseXml').resolves({
        Y: {
          fullName: 'child',
          test: 'testVal',
        },
      });
      env.stub(children[1], 'parseXml').resolves({
        X: {
          fullName: 'child2',
          test: 'testVal2',
        },
      });
      // force getChildren to return the children we just stubbed
      env.stub(component, 'getChildren').returns(children);

      const result = await transformer.toMetadataFormat(component);

      expect(result).to.deep.equal({
        component,
        writeInfos: [
          {
            source: new JsToXml(composedXmlObj),
            output: join('reginas', 'a.regina'),
          },
        ],
      });
    });
  });

  describe('toSourceFormat', () => {
    it('should decompose children into respective files for "topLevel" config', async () => {
      const component = DECOMPOSED_TOP_LEVEL_COMPONENT;
      const { fullName, type } = component;
      const transformer = new DecomposedMetadataTransformer(mockRegistry);
      const root = join('main', 'default', type.directoryName, fullName);
      env.stub(component, 'parseXml').resolves({
        DecomposedTopLevel: {
          [XML_NS_KEY]: XML_NS_URL,
          fullName,
          foo: 'bar',
          gs: [
            { name: 'child', test: 'testVal' },
            { name: 'child2', test: 'testVal2' },
          ],
        },
      });

      const result = await transformer.toSourceFormat(component);

      expect(result).to.deep.equal({
        component,
        writeInfos: [
          {
            source: new JsToXml({
              G: {
                [XML_NS_KEY]: XML_NS_URL,
                name: 'child',
                test: 'testVal',
              },
            }),
            output: join(root, 'child.g-meta.xml'),
          },
          {
            source: new JsToXml({
              G: {
                [XML_NS_KEY]: XML_NS_URL,
                name: 'child2',
                test: 'testVal2',
              },
            }),
            output: join(root, 'child2.g-meta.xml'),
          },
          {
            source: new JsToXml({
              DecomposedTopLevel: {
                [XML_NS_KEY]: XML_NS_URL,
                fullName,
                foo: 'bar',
              },
            }),
            output: join(root, `${fullName}.${type.suffix}-meta.xml`),
          },
        ],
      });
    });

    it('should decompose children into respective directories and files for "folderPerType" config', async () => {
      const { type, fullName } = component;
      const transformer = new DecomposedMetadataTransformer(mockRegistry);
      const root = join('main', 'default', type.directoryName, fullName);
      env.stub(component, 'parseXml').resolves({
        ReginaKing: {
          fullName,
          foo: 'bar',
          ys: { fullName: 'child', test: 'testVal' },
          xs: [
            { fullName: 'child2', test: 'testVal2' },
            { fullName: 'child3', test: 'testVal3' },
          ],
        },
      });

      const result = await transformer.toSourceFormat(component);

      expect(result).to.deep.equal({
        component,
        writeInfos: [
          {
            source: new JsToXml({
              Y: {
                [XML_NS_KEY]: XML_NS_URL,
                fullName: 'child',
                test: 'testVal',
              },
            }),
            output: join(root, type.children.types.y.directoryName, 'child.y-meta.xml'),
          },
          {
            source: new JsToXml({
              X: {
                [XML_NS_KEY]: XML_NS_URL,
                fullName: 'child2',
                test: 'testVal2',
              },
            }),
            output: join(root, type.children.types.x.directoryName, 'child2.x-meta.xml'),
          },
          {
            source: new JsToXml({
              X: {
                [XML_NS_KEY]: XML_NS_URL,
                fullName: 'child3',
                test: 'testVal3',
              },
            }),
            output: join(root, type.children.types.x.directoryName, 'child3.x-meta.xml'),
          },
          {
            source: new JsToXml({
              ReginaKing: {
                [XML_NS_KEY]: XML_NS_URL,
                fullName: component.fullName,
                foo: 'bar',
              },
            }),
            output: join(root, `${fullName}.${type.suffix}-meta.xml`),
          },
        ],
      });
    });

    it('should not create parent xml during decomposition when only children are being decomposed', async () => {
      const { type, fullName } = component;
      const transformer = new DecomposedMetadataTransformer(mockRegistry);
      const root = join('main', 'default', type.directoryName, fullName);
      env.stub(component, 'parseXml').resolves({
        ReginaKing: {
          ys: { fullName: 'child', test: 'testVal' },
          xs: [
            { fullName: 'child2', test: 'testVal2' },
            { fullName: 'child3', test: 'testVal3' },
          ],
        },
      });

      const result = await transformer.toSourceFormat(component);
      expect(result).to.deep.equal({
        component,
        writeInfos: [
          {
            source: new JsToXml({
              Y: {
                [XML_NS_KEY]: XML_NS_URL,
                fullName: 'child',
                test: 'testVal',
              },
            }),
            output: join(root, type.children.types.y.directoryName, 'child.y-meta.xml'),
          },
          {
            source: new JsToXml({
              X: {
                [XML_NS_KEY]: XML_NS_URL,
                fullName: 'child2',
                test: 'testVal2',
              },
            }),
            output: join(root, type.children.types.x.directoryName, 'child2.x-meta.xml'),
          },
          {
            source: new JsToXml({
              X: {
                [XML_NS_KEY]: XML_NS_URL,
                fullName: 'child3',
                test: 'testVal3',
              },
            }),
            output: join(root, type.children.types.x.directoryName, 'child3.x-meta.xml'),
          },
        ],
      });
    });

    it('should merge output with merge component only containing children', async () => {
      const mergeComponentChild = component.getChildren()[0];
      const componentToConvert = SourceComponent.createVirtualComponent(
        {
          name: 'a',
          type: mockRegistryData.types.reginaking,
        },
        []
      );
      env.stub(componentToConvert, 'parseXml').resolves({
        ReginaKing: {
          [XML_NS_KEY]: XML_NS_URL,
          [mergeComponentChild.type.directoryName]: {
            fullName: mergeComponentChild.name,
            test: 'testVal',
          },
        },
      });

      const transformer = new DecomposedMetadataTransformer(mockRegistry);
      const result = await transformer.toSourceFormat(componentToConvert, component);

      expect(result).to.deep.equal({
        component: componentToConvert,
        writeInfos: [
          {
            source: new JsToXml({
              [mergeComponentChild.type.name]: {
                [XML_NS_KEY]: XML_NS_URL,
                fullName: mergeComponentChild.name,
                test: 'testVal',
              },
            }),
            output: mergeComponentChild.xml,
          },
        ],
      });
    });

    it('should merge output with parent merge component', async () => {
      const componentToConvert = SourceComponent.createVirtualComponent(
        {
          name: 'a',
          type: mockRegistryData.types.reginaking,
        },
        []
      );
      env.stub(componentToConvert, 'parseXml').resolves({
        ReginaKing: {
          [XML_NS_KEY]: XML_NS_URL,
          fullName: component.fullName,
          foo: 'bar',
        },
      });

      const transformer = new DecomposedMetadataTransformer(mockRegistry);
      const result = await transformer.toSourceFormat(componentToConvert, component);

      expect(result).to.deep.equal({
        component: componentToConvert,
        writeInfos: [
          {
            source: new JsToXml({
              [component.type.name]: {
                [XML_NS_KEY]: XML_NS_URL,
                fullName: component.fullName,
                foo: 'bar',
              },
            }),
            output: component.xml,
          },
        ],
      });
    });
  });
});
