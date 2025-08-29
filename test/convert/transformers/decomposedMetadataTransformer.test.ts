/*
 * Copyright 2025, Salesforce, Inc.
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

import { join } from 'node:path';
import { expect, assert } from 'chai';
import { Messages } from '@salesforce/core';
import { TestContext } from '@salesforce/core/testSetup';
import { decomposed, matchingContentFile } from '../../mock';
import { DecomposedMetadataTransformer } from '../../../src/convert/transformers/decomposedMetadataTransformer';
import { baseName } from '../../../src/utils';
import { JsToXml } from '../../../src/convert/streams';
import { DECOMPOSED_TOP_LEVEL_COMPONENT } from '../../mock/type-constants/customObjectTranslationConstant';
import { ComponentSet, ForceIgnore, registry, RegistryAccess, SourceComponent } from '../../../src';
import { XML_NS_KEY, XML_NS_URL } from '../../../src/common';
import { ConvertContext } from '../../../src/convert/convertContext/convertContext';
import { simpleKey } from '../../../src/collections/componentSet';

const registryAccess = new RegistryAccess();

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/source-deploy-retrieve', 'sdr');

describe('DecomposedMetadataTransformer', () => {
  const $$ = new TestContext();
  const component = decomposed.DECOMPOSED_COMPONENT;

  describe('toMetadataFormat', () => {
    it('should defer write operations and set context state when child components are given', async () => {
      const [child1, child2] = component.getChildren();
      const context = new ConvertContext();
      const transformer = new DecomposedMetadataTransformer(registryAccess, context);

      expect(await transformer.toMetadataFormat(child1)).to.deep.equal([]);
      expect(await transformer.toMetadataFormat(child2)).to.deep.equal([]);
      expect(context.recomposition.transactionState.size).to.deep.equal(1);
      expect(context.recomposition.transactionState.get(simpleKey(component))).to.deep.equal({
        component,
        children: new ComponentSet([child1, child2], registryAccess),
      });
    });

    it('should defer write operations and set context state when a parent component is given', async () => {
      const context = new ConvertContext();
      const transformer = new DecomposedMetadataTransformer(registryAccess, context);

      expect(await transformer.toMetadataFormat(component)).to.deep.equal([]);
      expect(context.recomposition.transactionState.size).to.equal(1);

      expect(context.recomposition.transactionState.get(simpleKey(component))).to.deep.equal({
        component,
        children: new ComponentSet(component.getChildren(), registryAccess),
      });
    });

    it('should defer write operations and set context state when a child and parent component is given', async () => {
      const [child1, child2] = component.getChildren();
      const context = new ConvertContext();
      const transformer = new DecomposedMetadataTransformer(registryAccess, context);

      expect(await transformer.toMetadataFormat(child1)).to.deep.equal([]);
      expect(await transformer.toMetadataFormat(child2)).to.deep.equal([]);
      expect(await transformer.toMetadataFormat(component)).to.deep.equal([]);
      expect(context.recomposition.transactionState.size).to.deep.equal(1);

      const stateValue = context.recomposition.transactionState.get(simpleKey(component));
      assert(stateValue, 'expected stateValue to be defined');
      expect(stateValue.component).to.deep.equal(component);
      expect(stateValue.children?.size).to.deep.equal(2);
      expect(context.recomposition.transactionState.get(simpleKey(component))).to.deep.equal({
        component,
        children: new ComponentSet([child1, child2], registryAccess),
      });
    });

    it('should throw when an invalid child is included with the parent', async () => {
      const { CONTENT_NAMES, XML_NAMES } = matchingContentFile;
      const fsUnexpectedChild = [
        {
          dirPath: decomposed.DECOMPOSED_PATH,
          children: [decomposed.DECOMPOSED_CHILD_XML_NAME_1, decomposed.DECOMPOSED_CHILD_DIR, 'classes'],
        },
        {
          dirPath: decomposed.DECOMPOSED_CHILD_DIR_PATH,
          children: [decomposed.DECOMPOSED_CHILD_XML_NAME_2],
        },
        {
          dirPath: join(decomposed.DECOMPOSED_PATH, 'classes'),
          children: [CONTENT_NAMES[0], XML_NAMES[0]],
        },
      ];
      const parentComponent = SourceComponent.createVirtualComponent(
        {
          name: baseName(decomposed.DECOMPOSED_XML_PATH),
          type: decomposed.DECOMPOSED_COMPONENT.type,
          xml: decomposed.DECOMPOSED_XML_PATH,
          content: decomposed.DECOMPOSED_PATH,
        },
        fsUnexpectedChild
      );
      const fsPath = join(decomposed.DECOMPOSED_PATH, 'classes', XML_NAMES[0]);
      const transformer = new DecomposedMetadataTransformer(registryAccess, new ConvertContext());

      try {
        await transformer.toMetadataFormat(parentComponent);
        assert(false, 'expected TypeInferenceError to be thrown');
      } catch (err) {
        assert(err instanceof Error);
        expect(err.name).to.equal('TypeInferenceError');
        expect(err.message).to.equal(messages.getMessage('error_unexpected_child_type', [fsPath, component.type.name]));
      }
    });
  });

  describe('toSourceFormat', () => {
    it('should push writes for component and its children when type config is "FolderPerType"', async () => {
      const { fullName, type } = component;
      assert(type.children?.types.validationrule.directoryName);
      const root = join('main', 'default', type.directoryName, fullName);
      const context = new ConvertContext();
      const transformer = new DecomposedMetadataTransformer(registryAccess, context);
      $$.SANDBOX.stub(component, 'parseXml').resolves({
        CustomObject: {
          fullName,
          customField: [{ fullName: 'child', test: 'testVal' }],
          validationRules: [
            { fullName: 'child2', test: 'testVal2' },
            { fullName: 'child3', test: 'testVal3' },
          ],
        },
      });

      const result = await transformer.toSourceFormat({ component });

      expect(context.decomposition.transactionState.size).to.equal(0);
      expect(result).to.deep.equal([
        {
          source: new JsToXml({
            ValidationRule: {
              [XML_NS_KEY]: XML_NS_URL,
              fullName: 'child2',
              test: 'testVal2',
            },
          }),
          output: join(root, type.children.types.validationrule.directoryName, 'child2.validationRule-meta.xml'),
        },
        {
          source: new JsToXml({
            ValidationRule: {
              [XML_NS_KEY]: XML_NS_URL,
              fullName: 'child3',
              test: 'testVal3',
            },
          }),
          output: join(root, type.children.types.validationrule.directoryName, 'child3.validationRule-meta.xml'),
        },
        {
          source: new JsToXml({
            CustomObject: {
              [XML_NS_KEY]: XML_NS_URL,
              fullName: component.fullName,
              customField: [{ fullName: 'child', test: 'testVal' }],
            },
          }),
          output: join(root, `${fullName}.${type.suffix}-meta.xml`),
        },
      ]);
    });

    it('should push writes for component and its non-forceignored children', async () => {
      const { fullName, type } = component;
      assert(type.children?.types.validationrule.directoryName);

      const root = join('main', 'default', type.directoryName, fullName);
      const context = new ConvertContext();
      const transformer = new DecomposedMetadataTransformer(registryAccess, context);
      $$.SANDBOX.stub(component, 'parseXml').resolves({
        CustomObject: {
          fullName,
          customField: { fullName: 'child', test: 'testVal' },
          validationRules: [
            { fullName: 'child2', test: 'testVal2' },
            { fullName: 'child3', test: 'testVal3' },
          ],
        },
      });
      $$.SANDBOX.stub(ForceIgnore.prototype, 'accepts')
        .returns(true)
        .withArgs(
          join('main', 'default', 'objects', 'customObject__c', 'validationRules', 'child2.validationRule-meta.xml')
        )
        .returns(false);

      const result = await transformer.toSourceFormat({ component });

      expect(context.decomposition.transactionState.size).to.equal(0);
      expect(result).to.deep.equal([
        {
          source: new JsToXml({
            ValidationRule: {
              [XML_NS_KEY]: XML_NS_URL,
              fullName: 'child3',
              test: 'testVal3',
            },
          }),
          output: join(root, type.children.types.validationrule.directoryName, 'child3.validationRule-meta.xml'),
        },
        {
          source: new JsToXml({
            CustomObject: {
              [XML_NS_KEY]: XML_NS_URL,
              fullName: component.fullName,
              customField: {
                fullName: 'child',
                test: 'testVal',
              },
            },
          }),
          output: join(root, `${fullName}.${type.suffix}-meta.xml`),
        },
      ]);
    });

    it('should push writes for component and its children when type config is "TopLevel"', async () => {
      const component = DECOMPOSED_TOP_LEVEL_COMPONENT;
      const { fullName, type } = component;
      const transformer = new DecomposedMetadataTransformer();
      const root = join('main', 'default', type.directoryName, fullName);
      $$.SANDBOX.stub(component, 'parseXml').resolves({
        CustomObjectTranslation: {
          [XML_NS_KEY]: XML_NS_URL,
          fullName,
          CustomFieldTranslation: [
            { name: 'child', test: 'testVal' },
            { name: 'child2', test: 'testVal2' },
          ],
        },
      });

      const result = await transformer.toSourceFormat({ component });

      expect(result).to.deep.equal([
        {
          source: new JsToXml({
            CustomObjectTranslation: {
              [XML_NS_KEY]: XML_NS_URL,
              CustomFieldTranslation: [
                {
                  name: 'child',
                  test: 'testVal',
                },
                { name: 'child2', test: 'testVal2' },
              ],
              fullName,
            },
          }),
          output: join(root, `${fullName}.${type.suffix}-meta.xml`),
        },
      ]);
    });

    it('should not create parent xml when only children are being decomposed', async () => {
      const { type, fullName } = component;
      assert(type.children?.types.validationrule.directoryName);

      const transformer = new DecomposedMetadataTransformer();
      const root = join('main', 'default', type.directoryName, fullName);
      $$.SANDBOX.stub(component, 'parseXml').resolves({
        CustomObject: {
          customField: [{ fullName: 'child', test: 'testVal' }],
          validationRules: [
            { fullName: 'child2', test: 'testVal2' },
            { fullName: 'child3', test: 'testVal3' },
          ],
        },
      });

      const result = await transformer.toSourceFormat({ component });

      expect(result).to.deep.equal([
        {
          source: new JsToXml({
            ValidationRule: {
              [XML_NS_KEY]: XML_NS_URL,
              fullName: 'child2',
              test: 'testVal2',
            },
          }),
          output: join(root, type.children.types.validationrule.directoryName, 'child2.validationRule-meta.xml'),
        },
        {
          source: new JsToXml({
            ValidationRule: {
              [XML_NS_KEY]: XML_NS_URL,
              fullName: 'child3',
              test: 'testVal3',
            },
          }),
          output: join(root, type.children.types.validationrule.directoryName, 'child3.validationRule-meta.xml'),
        },
        {
          source: new JsToXml({
            CustomObject: {
              [XML_NS_KEY]: XML_NS_URL,
              customField: [{ fullName: 'child', test: 'testVal' }],
            },
          }),
          output: join(root, 'customObject__c.object-meta.xml'),
        },
      ]);
    });

    it('should create a parent xml when unaddressableWithoutParent = true on the child type', async () => {
      const component = DECOMPOSED_TOP_LEVEL_COMPONENT;
      const { type, fullName } = component;

      const transformer = new DecomposedMetadataTransformer();
      const root = join('main', 'default', type.directoryName, fullName);
      $$.SANDBOX.stub(component, 'parseXml').resolves({
        CustomObjectTranslation: {
          fields: [
            { name: 'child', test: 'testVal' },
            { name: 'child2', test: 'testVal2' },
          ],
        },
      });

      const result = await transformer.toSourceFormat({ component });

      expect(result).to.deep.equal([
        {
          source: new JsToXml({
            CustomFieldTranslation: {
              [XML_NS_KEY]: XML_NS_URL,
              name: 'child',
              test: 'testVal',
            },
          }),
          output: join(root, 'child.fieldTranslation-meta.xml'),
        },
        {
          source: new JsToXml({
            CustomFieldTranslation: {
              [XML_NS_KEY]: XML_NS_URL,
              name: 'child2',
              test: 'testVal2',
            },
          }),
          output: join(root, 'child2.fieldTranslation-meta.xml'),
        },
        // the new parent was written
        {
          source: new JsToXml({
            [type.name]: {
              [XML_NS_KEY]: XML_NS_URL,
            },
          }),
          output: join(root, 'myObject__c.objectTranslation-meta.xml'),
        },
      ]);
    });

    it('should merge unaddressableWithoutParent types with their parent, regardless of location', async () => {
      const cot = DECOMPOSED_TOP_LEVEL_COMPONENT;
      const cft = DECOMPOSED_TOP_LEVEL_COMPONENT;
      const { type, fullName } = cot;

      const transformer = new DecomposedMetadataTransformer();
      const root = join('path', 'to', type.directoryName, fullName);
      $$.SANDBOX.stub(cot, 'parseXml').resolves({
        CustomObjectTranslation: {
          fields: [
            { name: 'child', test: 'testVal' },
            { name: 'child2', test: 'testVal2' },
          ],
        },
      });

      const result = await transformer.toSourceFormat({ component: cft, mergeWith: cot });

      expect(result).to.deep.equal([
        {
          source: new JsToXml({
            CustomFieldTranslation: {
              [XML_NS_KEY]: XML_NS_URL,
              name: 'child',
              test: 'testVal',
            },
          }),
          output: join(root, 'child.fieldTranslation-meta.xml'),
        },
        {
          source: new JsToXml({
            CustomFieldTranslation: {
              [XML_NS_KEY]: XML_NS_URL,
              name: 'child2',
              test: 'testVal2',
            },
          }),
          output: join(root, 'child2.fieldTranslation-meta.xml'),
        },
        // the new parent was written
        {
          source: new JsToXml({
            [type.name]: {
              [XML_NS_KEY]: XML_NS_URL,
            },
          }),
          output: join(root, 'myObject__c.objectTranslation-meta.xml'),
        },
      ]);
    });

    it('should handle decomposed parents with no files', async () => {
      const transformer = new DecomposedMetadataTransformer();
      $$.SANDBOX.stub(component, 'parseXml').resolves({});

      const result = await transformer.toSourceFormat({ component });

      expect(result).to.be.an('array').with.lengthOf(1);
      // there will be a file produced, with just the outer type (ex: CustomObject) and the xmlns declaration
      expect(result[0].output).to.equal(
        join('main', 'default', 'objects', 'customObject__c', 'customObject__c.object-meta.xml')
      );
    });

    it('should return no files when the parent is forceIgnored', async () => {
      const { fullName } = component;
      const context = new ConvertContext();
      const transformer = new DecomposedMetadataTransformer(registryAccess, context);

      $$.SANDBOX.stub(component, 'parseXml').resolves({
        CustomObject: {
          fullName,
          customField: [{ fullName: 'child', test: 'testVal' }],
          validationRules: [
            { fullName: 'child2', test: 'testVal2' },
            { fullName: 'child3', test: 'testVal3' },
          ],
        },
      });
      $$.SANDBOX.stub(ForceIgnore.prototype, 'denies')
        .returns(false)
        .withArgs(join('main', 'default', 'objects', 'customObject__c', 'customObject__c.object-meta.xml'))
        .returns(true);

      const result = await transformer.toSourceFormat({ component });

      expect(result).to.deep.equal([]);
    });

    describe('Merging Components', () => {
      it('should merge output with merge component that only has children', async () => {
        assert(registry.types.customobject.children?.types.customfield.name);
        const mergeComponentChild = component.getChildren()[1];
        assert(mergeComponentChild.parent);
        const componentToConvert = SourceComponent.createVirtualComponent(
          {
            name: 'CustomObject__c',
            type: registry.types.customobject,
          },
          []
        );
        $$.SANDBOX.stub(componentToConvert, 'parseXml').resolves({
          [registry.types.customobject.name]: {
            [registry.types.customobject.children.types.customfield.name]: [
              { fullName: mergeComponentChild.fullName, test: 'testVal' },
            ],
          },
        });

        const transformer = new DecomposedMetadataTransformer(registryAccess);
        const result = await transformer.toSourceFormat({ component: componentToConvert, mergeWith: component });

        expect(result).to.deep.equal([
          {
            source: new JsToXml({
              CustomObject: {
                [XML_NS_KEY]: XML_NS_URL,
                [mergeComponentChild.type.name]: [
                  {
                    fullName: mergeComponentChild.fullName,
                    test: 'testVal',
                  },
                ],
              },
            }),
            output: mergeComponentChild.parent.xml,
          },
        ]);
      });

      it('should merge output with parent merge component', async () => {
        const componentToConvert = SourceComponent.createVirtualComponent(
          {
            name: 'a',
            type: registry.types.customobject,
          },
          []
        );
        $$.SANDBOX.stub(componentToConvert, 'parseXml').resolves({
          [registry.types.customobject.name]: {
            [XML_NS_KEY]: XML_NS_URL,
            fullName: component.fullName,
            foo: 'bar',
          },
        });
        const transformer = new DecomposedMetadataTransformer();

        const result = await transformer.toSourceFormat({ component: componentToConvert, mergeWith: component });

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

      it('should throw when an invalid merge child is included with the parent', async () => {
        const { CONTENT_NAMES, XML_NAMES } = matchingContentFile;
        const fsUnexpectedChild = [
          {
            dirPath: decomposed.DECOMPOSED_PATH,
            children: [decomposed.DECOMPOSED_CHILD_XML_NAME_1, decomposed.DECOMPOSED_CHILD_DIR, 'classes'],
          },
          {
            dirPath: decomposed.DECOMPOSED_CHILD_DIR_PATH,
            children: [decomposed.DECOMPOSED_CHILD_XML_NAME_2],
          },
          {
            dirPath: join(decomposed.DECOMPOSED_PATH, 'classes'),
            children: [CONTENT_NAMES[0], XML_NAMES[0]],
          },
        ];
        const parentComponent = SourceComponent.createVirtualComponent(
          {
            name: baseName(decomposed.DECOMPOSED_XML_PATH),
            type: decomposed.DECOMPOSED_COMPONENT.type,
            xml: decomposed.DECOMPOSED_XML_PATH,
            content: decomposed.DECOMPOSED_PATH,
          },
          fsUnexpectedChild
        );
        const fsPath = join(decomposed.DECOMPOSED_PATH, 'classes', XML_NAMES[0]);
        const transformer = new DecomposedMetadataTransformer(registryAccess, new ConvertContext());

        try {
          // NOTE: it doesn't matter what the first component is for this test since it's all
          // about the child components of the parentComponent.
          await transformer.toSourceFormat({ component, mergeWith: parentComponent });
          assert(false, 'expected TypeInferenceError to be thrown');
        } catch (err) {
          assert(err instanceof Error);
          expect(err.name).to.equal('TypeInferenceError');
          expect(err.message).to.equal(
            messages.getMessage('error_unexpected_child_type', [fsPath, component.type.name])
          );
        }
      });

      it('should defer write operations for children that are not members of merge component', async () => {
        const mergeComponentChild = component.getChildren()[0];
        const { fullName, type } = component;
        const root = join('main', 'default', type.directoryName, fullName);
        const componentToMerge = SourceComponent.createVirtualComponent(
          {
            name: 'a',
            type,
          },
          []
        );
        $$.SANDBOX.stub(component, 'parseXml').resolves({
          [type.name]: {
            [XML_NS_KEY]: XML_NS_URL,
            [mergeComponentChild.type.directoryName]: {
              fullName: mergeComponentChild.name,
              test: 'testVal',
            },
          },
        });
        const context = new ConvertContext();
        const transformer = new DecomposedMetadataTransformer(registryAccess, context);

        const result = await transformer.toSourceFormat({ component, mergeWith: componentToMerge });
        expect(result).to.be.empty;
        expect(context.decomposition.transactionState.get(simpleKey(mergeComponentChild))).to.deep.equal({
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
        });
      });

      it('should defer write operation for parent xml that is not a member of merge component', async () => {
        const { fullName, type } = component;
        const root = join('main', 'default', type.directoryName, fullName);
        const mergeWith = SourceComponent.createVirtualComponent(
          {
            name: 'a',
            type,
          },
          []
        );
        $$.SANDBOX.stub(component, 'parseXml').resolves({
          [type.name]: {
            [XML_NS_KEY]: XML_NS_URL,
            fullName: component.fullName,
            foo: 'bar',
          },
        });
        const context = new ConvertContext();
        const transformer = new DecomposedMetadataTransformer(registryAccess, context);

        const result = await transformer.toSourceFormat({ component, mergeWith });
        expect(result).to.be.empty;
        expect(context.decomposition.transactionState.get(simpleKey(component))).to.deep.equal({
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
        });
      });
    });
  });
});
