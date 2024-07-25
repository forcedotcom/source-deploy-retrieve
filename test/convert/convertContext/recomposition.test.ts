/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { join } from 'node:path';
import { expect } from 'chai';
import { createSandbox } from 'sinon';
import { unwrapAndOmitNS } from '../../../src/utils/decomposed';
import { decomposed, nonDecomposed } from '../../mock';
import { ConvertContext } from '../../../src/convert/convertContext/convertContext';
import { ComponentSet } from '../../../src/collections/componentSet';
import { JsToXml } from '../../../src/convert/streams';
import { RegistryAccess } from '../../../src/registry/registryAccess';
import { SourceComponent } from '../../../src/resolve/sourceComponent';
import { XML_NS_KEY, XML_NS_URL } from '../../../src/common/constants';
import { VirtualTreeContainer } from '../../../src/resolve/treeContainers';
import { VirtualDirectory } from '../../../src/resolve/types';
import { CHILD_1_XML, CHILD_2_XML } from '../../mock/type-constants/customlabelsConstant';

describe('Recomposition', () => {
  describe('omitXmlNsKey', () => {
    it('should remove the XML_NS_KEY from the xml', () => {
      const xml = {
        CustomField: {
          fullName: 'child1',
          '@_xmlns': 'http://soap.sforce.com/2006/04/metadata',
        },
      };
      expect(unwrapAndOmitNS('CustomField')(xml)).to.deep.equal({
        fullName: 'child1',
      });
    });
    it('should leaves non-NS xml alone', () => {
      const xml = {
        CustomField: {
          fullName: 'child1',
        },
      };
      expect(unwrapAndOmitNS('CustomField')(xml)).to.deep.equal(xml.CustomField);
    });
    it('should return input when types do not match', () => {
      const xml = {
        CustomField: {
          fullName: 'child1',
        },
      };
      expect(unwrapAndOmitNS('CustomLabels')(xml)).to.deep.equal(xml);
    });
  });

  describe('finalize', () => {
    const env = createSandbox();
    afterEach(() => env.restore());

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
      context.recomposition.transactionState.set(component.fullName, {
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

      expect(readFileSpy.callCount, JSON.stringify(readFileSpy.getCalls(), undefined, 2)).to.equal(1);
    });

    describe('should only read unique child xml files once per parent for non-decomposed components', () => {
      // This test sets up 2 CustomLabels files; 1 in each package directory. The CustomLabels files
      // each have 2 labels within them. This should result in only 2 file reads; 1 per parent CustomLabels file.
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
        { name: 'CustomLabels2', type: customLabelsType, xml: parentXmlPath2 },
        new VirtualTreeContainer(vDir)
      );

      it('one main component with multiple parents in transaction state covering all the children', async () => {
        const context = new ConvertContext();
        const compSet = new ComponentSet();
        component.getChildren().forEach((child) => compSet.add(child));
        component2.getChildren().forEach((child) => compSet.add(child));
        context.recomposition.transactionState.set(component.fullName, {
          component,
          children: compSet,
        });

        const readFileSpy = env.spy(VirtualTreeContainer.prototype, 'readFile');

        await context.recomposition.finalize();

        expect(readFileSpy.callCount, 'readFile() should only be called twice').to.equal(2);
      });
    });
  });
});
