/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { regina } from '../../mock/registry';
import { DecomposedMetadataTransformer } from '../../../src/convert/transformers/decomposedMetadataTransformer';
import {
  ConvertTransaction,
  RecompositionFinalizer,
} from '../../../src/convert/convertTransaction';
import { expect } from 'chai';
import { createSandbox } from 'sinon';
import { XML_NS, XML_NS_KEY } from '../../../src/utils/constants';
import { join } from 'path';
import { JsToXml } from '../../../src/convert/streams';

const env = createSandbox();

describe('DecomposedMetadataTransformer', () => {
  const component = regina.REGINA_COMPONENT;
  const composedXmlObj = {
    ReginaKing: {
      [XML_NS_KEY]: XML_NS,
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

    new DecomposedMetadataTransformer(component, transaction);

    expect(addFinalizerSpy.calledWith(RecompositionFinalizer)).to.be.true;
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

    it('should fully recompose metadata when a parent component is given', () => {
      const transformer = new DecomposedMetadataTransformer(component, new ConvertTransaction());
      const children = component.getChildren();
      env.stub(component, 'parseXml').returns({
        ReginaKing: {
          [XML_NS_KEY]: XML_NS,
          fullName: component.fullName,
          foo: 'bar',
        },
      });
      env.stub(children[0], 'parseXml').returns({
        Y: {
          fullName: 'child',
          test: 'testVal',
        },
      });
      env.stub(children[1], 'parseXml').returns({
        X: {
          fullName: 'child2',
          test: 'testVal2',
        },
      });
      // force getChildren to return the children we just stubbed
      env.stub(component, 'getChildren').returns(children);

      const result = transformer.toMetadataFormat();

      expect(result).to.deep.equal({
        component,
        writeInfos: [
          {
            source: new JsToXml(composedXmlObj),
            relativeDestination: join('reginas', 'a.regina'),
          },
        ],
      });
    });
  });

  describe('toSourceFormat', () => {
    it('should decompose children into respective directories and files', () => {
      const { type, fullName } = component;
      const transformer = new DecomposedMetadataTransformer(component);
      const root = join(type.directoryName, fullName);
      env.stub(component, 'parseXml').returns({
        ReginaKing: {
          [XML_NS_KEY]: XML_NS,
          fullName,
          foo: 'bar',
          ys: { fullName: 'child', test: 'testVal' },
          xs: [
            { fullName: 'child2', test: 'testVal2' },
            { fullName: 'child3', test: 'testVal3' },
          ],
        },
      });

      const result = transformer.toSourceFormat();

      expect(result).to.deep.equal({
        component,
        writeInfos: [
          {
            source: new JsToXml({
              Y: {
                [XML_NS_KEY]: XML_NS,
                fullName: 'child',
                test: 'testVal',
              },
            }),
            relativeDestination: join(
              root,
              type.children.types.y.directoryName,
              'child.y-meta.xml'
            ),
          },
          {
            source: new JsToXml({
              X: {
                [XML_NS_KEY]: XML_NS,
                fullName: 'child2',
                test: 'testVal2',
              },
            }),
            relativeDestination: join(
              root,
              type.children.types.x.directoryName,
              'child2.x-meta.xml'
            ),
          },
          {
            source: new JsToXml({
              X: {
                [XML_NS_KEY]: XML_NS,
                fullName: 'child3',
                test: 'testVal3',
              },
            }),
            relativeDestination: join(
              root,
              type.children.types.x.directoryName,
              'child3.x-meta.xml'
            ),
          },
          {
            source: new JsToXml({
              ReginaKing: {
                [XML_NS_KEY]: XML_NS,
                fullName: component.fullName,
                foo: 'bar',
              },
            }),
            relativeDestination: join(root, `${fullName}.${type.suffix}-meta.xml`),
          },
        ],
      });
    });
  });
});
