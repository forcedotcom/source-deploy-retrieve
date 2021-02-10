/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { mockRegistry, mockRegistryData, regina } from '../../mock/registry';
import { DecomposedMetadataTransformer } from '../../../src/convert/transformers/decomposedMetadataTransformer';
import { expect } from 'chai';
import { createSandbox } from 'sinon';
import { join } from 'path';
import { JsToXml } from '../../../src/convert/streams';
import { DECOMPOSED_TOP_LEVEL_COMPONENT } from '../../mock/registry/decomposedTopLevelConstants';
import { ComponentSet, SourceComponent } from '../../../src';
import { XML_NS_URL, XML_NS_KEY } from '../../../src/common';
import { ConvertContext } from '../../../src/convert/convertContext';

const env = createSandbox();

describe('DecomposedMetadataTransformer', () => {
  const component = regina.REGINA_COMPONENT;

  afterEach(() => env.restore());

  describe('toMetadataFormat', () => {
    it('should defer write operations and set context state when a child components are given', async () => {
      const [child1, child2] = component.getChildren();
      const context = new ConvertContext();
      const transformer = new DecomposedMetadataTransformer(mockRegistry, context);

      expect(await transformer.toMetadataFormat(child1)).to.deep.equal([]);
      expect(await transformer.toMetadataFormat(child2)).to.deep.equal([]);
      expect(context.recomposition.state).to.deep.equal({
        [component.fullName]: {
          component,
          children: new ComponentSet([child1, child2], mockRegistry),
        },
      });
    });

    it('should defer write operations and set context state when a parent component is given', async () => {
      const context = new ConvertContext();
      const transformer = new DecomposedMetadataTransformer(mockRegistry, context);

      expect(await transformer.toMetadataFormat(component)).to.deep.equal([]);
      expect(context.recomposition.state).to.deep.equal({
        [component.fullName]: {
          component,
          children: new ComponentSet(component.getChildren(), mockRegistry),
        },
      });
    });

    it('should defer write operations and set context state when a child and parent component is given', async () => {
      const [child] = component.getChildren();
      const context = new ConvertContext();
      const transformer = new DecomposedMetadataTransformer(mockRegistry, context);

      expect(await transformer.toMetadataFormat(child)).to.deep.equal([]);
      expect(await transformer.toMetadataFormat(component)).to.deep.equal([]);
      expect(context.recomposition.state).to.deep.equal({
        [component.fullName]: {
          component,
          children: new ComponentSet([child].concat(component.getChildren()), mockRegistry),
        },
      });
    });
  });

  describe('toSourceFormat', () => {
    it('should push writes for component and its children when type config is "FolderPerType"', async () => {
      const { fullName, type } = component;
      const root = join('main', 'default', type.directoryName, fullName);
      const context = new ConvertContext();
      const transformer = new DecomposedMetadataTransformer(mockRegistry, context);
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

      expect(context.decomposition.state).to.deep.equal({});
      expect(result).to.deep.equal([
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
      ]);
    });

    it('should push writes for component and its children when type config is "TopLevel"', async () => {
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

      expect(result).to.deep.equal([
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
      ]);
    });

    it('should not create parent xml when only children are being decomposed', async () => {
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

      expect(result).to.deep.equal([
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
      ]);
    });

    describe('Merging Components', () => {
      it('should merge output with merge component that only has children', async () => {
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

        expect(result).to.deep.equal([
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
        ]);
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

        expect(result).to.deep.equal([
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
        ]);
      });

      it('should defer write operations for children that are not members of merge component', async () => {
        const mergeComponentChild = component.getChildren()[0];
        const { fullName, type } = component;
        const root = join('main', 'default', type.directoryName, fullName);
        const componentToMerge = SourceComponent.createVirtualComponent(
          {
            name: 'a',
            type: mockRegistryData.types.reginaking,
          },
          []
        );
        env.stub(component, 'parseXml').resolves({
          ReginaKing: {
            [XML_NS_KEY]: XML_NS_URL,
            [mergeComponentChild.type.directoryName]: {
              fullName: mergeComponentChild.name,
              test: 'testVal',
            },
          },
        });
        const context = new ConvertContext();
        const transformer = new DecomposedMetadataTransformer(mockRegistry, context);

        const result = await transformer.toSourceFormat(component, componentToMerge);
        expect(result).to.be.empty;
        expect(context.decomposition.state).to.deep.equal({
          [`${mergeComponentChild.type.name}#${mergeComponentChild.fullName}`]: {
            foundMerge: false,
            origin: component,
            writeInfo: {
              source: new JsToXml({
                [mergeComponentChild.type.name]: {
                  [XML_NS_KEY]: XML_NS_URL,
                  fullName: mergeComponentChild.name,
                  test: 'testVal',
                },
              }),
              output: join(
                root,
                mergeComponentChild.type.directoryName,
                `${mergeComponentChild.name}.${mergeComponentChild.type.suffix}-meta.xml`
              ),
            },
          },
        });
      });

      it('should defer write operation for parent xml that is not a member of merge component', async () => {
        // const mergeComponentChild = component.getChildren()[0];
        const { fullName, type } = component;
        const root = join('main', 'default', type.directoryName, fullName);
        const componentToMerge = SourceComponent.createVirtualComponent(
          {
            name: 'a',
            type: mockRegistryData.types.reginaking,
          },
          []
        );
        env.stub(component, 'parseXml').resolves({
          ReginaKing: {
            [XML_NS_KEY]: XML_NS_URL,
            fullName: component.fullName,
            foo: 'bar',
          },
        });
        const context = new ConvertContext();
        const transformer = new DecomposedMetadataTransformer(mockRegistry, context);

        const result = await transformer.toSourceFormat(component, componentToMerge);
        expect(result).to.be.empty;
        expect(context.decomposition.state).to.deep.equal({
          [`${type.name}#${fullName}`]: {
            foundMerge: false,
            origin: component,
            writeInfo: {
              source: new JsToXml({
                [type.name]: {
                  [XML_NS_KEY]: XML_NS_URL,
                  fullName,
                  foo: 'bar',
                },
              }),
              output: join(root, `${fullName}.${type.suffix}-meta.xml`),
            },
          },
        });
      });
    });
  });
});
