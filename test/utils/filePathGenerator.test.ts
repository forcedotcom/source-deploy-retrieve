/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as path from 'path';
import { expect } from 'chai';
import deepEqualInAnyOrder = require('deep-equal-in-any-order');
import chai = require('chai');
import { filePathsFromMetadataComponent } from '../../src/utils/filePathGenerator';
import { MetadataComponent, MetadataResolver, MetadataType, RegistryAccess, VirtualTreeContainer } from '../../src';

chai.use(deepEqualInAnyOrder);

interface TypeEntry {
  fullName: string;
  typeName: string;
  expectedFilePaths: string[];
  expectedComponents?: Array<{
    name?: string;
    type?: MetadataType;
    content?: string;
    xml?: string;
  }>;
}

const registryAccess = new RegistryAccess();
const packageDir = path.normalize('force-app/main/default');

const getFilePath = (f: string) => path.join(packageDir, path.normalize(f));

const testData = {
  default: {
    fullName: 'MyFlow',
    typeName: 'Flow',
    expectedFilePaths: [getFilePath('flows/MyFlow.flow-meta.xml')],
  },
  matchingContent: {
    fullName: 'MyClass',
    typeName: 'ApexClass',
    expectedFilePaths: [getFilePath('classes/MyClass.cls-meta.xml'), getFilePath('classes/MyClass.cls')],
    expectedComponents: [
      {
        content: getFilePath('classes/MyClass.cls'),
        xml: getFilePath('classes/MyClass.cls-meta.xml'),
      },
    ],
  },
  matchingContentInFolder: {
    fullName: 'aFolder/someTemplate',
    typeName: 'EmailTemplate',
    expectedFilePaths: [
      getFilePath('email/aFolder.emailFolder-meta.xml'),
      getFilePath('email/aFolder/someTemplate.email-meta.xml'),
      getFilePath('email/aFolder/someTemplate.email'),
    ],
    expectedComponents: [
      {
        name: 'aFolder',
        type: registryAccess.getTypeByName('EmailFolder'),
        xml: getFilePath('email/aFolder.emailFolder-meta.xml'),
      },
      {
        content: getFilePath('email/aFolder/someTemplate.email'),
        xml: getFilePath('email/aFolder/someTemplate.email-meta.xml'),
      },
    ],
  },
  mixedContent: {
    fullName: 'E_Bikes1',
    typeName: 'ExperienceBundle',
    expectedFilePaths: [getFilePath('experiences/E_Bikes1.site-meta.xml'), getFilePath('experiences/E_Bikes1')],
  },
  mixedContentInFolder: {
    fullName: 'MyDocumentFolder/MyDocumentName.png',
    typeName: 'Document',
    expectedFilePaths: [
      getFilePath('documents/MyDocumentFolder.documentFolder-meta.xml'),
      getFilePath('documents/MyDocumentFolder/MyDocumentName.png-meta.xml'),
      getFilePath('documents/MyDocumentFolder/MyDocumentName.png'),
    ],
    expectedComponents: [
      {
        name: 'MyDocumentFolder',
        type: registryAccess.getTypeByName('DocumentFolder'),
        xml: getFilePath('documents/MyDocumentFolder.documentFolder-meta.xml'),
      },
      {
        name: 'MyDocumentFolder/MyDocumentName',
        content: getFilePath('documents/MyDocumentFolder/MyDocumentName.png'),
        xml: getFilePath('documents/MyDocumentFolder/MyDocumentName.png-meta.xml'),
      },
    ],
  },
  mixedContentTransformed: {
    fullName: 'zippedResource',
    typeName: 'StaticResource',
    expectedFilePaths: [
      getFilePath('staticresources/zippedResource.resource-meta.xml'),
      getFilePath('staticresources/zippedResource'),
    ],
    expectedComponents: [
      {
        xml: getFilePath('staticresources/zippedResource.resource-meta.xml'),
      },
    ],
  },
  bundleLwc: {
    fullName: 'MyLwc',
    typeName: 'LightningComponentBundle',
    expectedFilePaths: [getFilePath('lwc/MyLwc/MyLwc.js-meta.xml')],
    expectedComponents: [
      {
        xml: getFilePath('lwc/MyLwc/MyLwc.js-meta.xml'),
      },
    ],
  },
  bundleAura: {
    fullName: 'MyCmp',
    typeName: 'AuraDefinitionBundle',
    expectedFilePaths: [getFilePath('aura/MyCmp/MyCmp.cmp-meta.xml')],
    expectedComponents: [
      {
        xml: getFilePath('aura/MyCmp/MyCmp.cmp-meta.xml'),
      },
    ],
  },
  bundleWave: {
    fullName: 'WT',
    typeName: 'WaveTemplateBundle',
    expectedFilePaths: [getFilePath('waveTemplates/WT/template-info.json')],
    expectedComponents: [
      {
        content: getFilePath('waveTemplates/WT'),
      },
    ],
  },
  nonDecomposedExplicit: {
    fullName: 'CustomLabels',
    typeName: 'CustomLabels',
    expectedFilePaths: [getFilePath('labels/CustomLabels.labels-meta.xml')],
    expectedComponents: [
      {
        xml: getFilePath('labels/CustomLabels.labels-meta.xml'),
      },
    ],
  },
  nonDecomposedImplicit: {
    fullName: 'MyWorkflow',
    typeName: 'Workflow',
    expectedFilePaths: [getFilePath('workflows/MyWorkflow.workflow-meta.xml')],
    expectedComponents: [
      {
        xml: getFilePath('workflows/MyWorkflow.workflow-meta.xml'),
      },
    ],
  },
  decomposedParent: {
    fullName: 'Stuff__c',
    typeName: 'CustomObject',
    expectedFilePaths: [getFilePath('objects/Stuff__c/Stuff__c.object-meta.xml')],
    expectedComponents: [
      {
        xml: getFilePath('objects/Stuff__c/Stuff__c.object-meta.xml'),
      },
    ],
  },
  decomposedChild: {
    fullName: 'Stuff__c.Field__c',
    typeName: 'CustomField',
    expectedFilePaths: [
      getFilePath('objects/Stuff__c/Stuff__c.object-meta.xml'),
      getFilePath('objects/Stuff__c/fields/Field__c.field-meta.xml'),
    ],
    expectedComponents: [
      {
        name: 'Stuff__c',
        type: registryAccess.getTypeByName('CustomObject'),
        xml: getFilePath('objects/Stuff__c/Stuff__c.object-meta.xml'),
      },
    ],
  },
  digitalExperienceBundle: {
    fullName: 'site/foo',
    typeName: 'DigitalExperienceBundle',
    expectedFilePaths: [getFilePath('digitalExperiences/site/foo/foo.digitalExperience-meta.xml')],
    expectedComponents: [
      {
        name: 'site/foo',
        type: registryAccess.getTypeByName('DigitalExperienceBundle'),
        xml: getFilePath('digitalExperiences/site/foo/foo.digitalExperience-meta.xml'),
      },
    ],
  },
  digitalExperience: {
    fullName: 'site/foo.sfdc_cms__view/home',
    typeName: 'DigitalExperience',
    expectedFilePaths: [getFilePath('digitalExperiences/site/foo/sfdc_cms__view/home/_meta.json')],
    expectedComponents: [
      {
        name: 'sfdc_cms__view/home',
        type: registryAccess.getTypeByName('DigitalExperience'),
      },
    ],
  },
};

describe('generating virtual tree from component name/type', () => {
  const generateComponent = (fullName: string, typeName: string): MetadataComponent => ({
    fullName,
    type: registryAccess.getTypeByName(typeName),
  });

  const runTest = (typeEntry: TypeEntry) => {
    // part 1: do you get the files you expect
    const component = generateComponent(typeEntry.fullName, typeEntry.typeName);
    const filePaths = filePathsFromMetadataComponent(component, packageDir);
    expect(filePaths).to.deep.equal(typeEntry.expectedFilePaths);

    // part 2: are the files resolvable into the expected component?
    const resolver = new MetadataResolver(registryAccess, VirtualTreeContainer.fromFilePaths(filePaths));

    const components = resolver.getComponentsFromPath(packageDir);
    const expectedComponentsSize = typeEntry.expectedComponents?.length || 1;
    expect(components).to.have.lengthOf(expectedComponentsSize);

    for (let i = 0; i < expectedComponentsSize; i++) {
      const definedExpComp = typeEntry.expectedComponents ? typeEntry.expectedComponents[i] : {};
      const expectedComp = Object.assign({}, { name: component.fullName, type: component.type }, definedExpComp);
      expect(components[i]).to.include(expectedComp);
    }
  };

  it('works for default type (flow)', () => {
    runTest(testData.default);
  });

  describe('no strategy, with folders (report)', () => {
    it('works for top-level not in a folder', () => {
      const component = { fullName: 'MyReport', type: registryAccess.getTypeByName('Report') };
      const filenames = filePathsFromMetadataComponent(component, packageDir);
      expect(filenames).to.deep.equal(
        ['reports/MyReport.report-meta.xml'].map((f) => path.join(packageDir, path.normalize(f)))
      );
    });
    it('works for a report in a folder', () => {
      const component = { fullName: 'myFolder/MyReport', type: registryAccess.getTypeByName('Report') };
      const filenames = filePathsFromMetadataComponent(component, packageDir);
      expect(filenames).to.deep.equalInAnyOrder(
        ['reports/myFolder.reportFolder-meta.xml', 'reports/myFolder/MyReport.report-meta.xml'].map((f) =>
          path.join(packageDir, path.normalize(f))
        )
      );
    });
    it('works for a report in a nested folder', () => {
      const component = { fullName: 'myFolder/otherFolder/MyReport', type: registryAccess.getTypeByName('Report') };
      const filenames = filePathsFromMetadataComponent(component, packageDir);
      expect(filenames).to.have.lengthOf(3);
      expect(filenames).to.deep.equalInAnyOrder(
        [
          'reports/myFolder.reportFolder-meta.xml',
          'reports/myFolder/otherFolder.reportFolder-meta.xml',
          'reports/myFolder/otherFolder/MyReport.report-meta.xml',
        ].map((f) => path.join(packageDir, path.normalize(f)))
      );
    });
  });

  describe('strategy = matchingContentFile', () => {
    it('works for matchingContentFile without folder (apexClass)', () => {
      runTest(testData.matchingContent);
    });

    it('works for matchingContentFile with folder (emailTemplate and emailFolder)', () => {
      runTest(testData.matchingContentInFolder);
    });
  });

  describe('strategy = mixedContent', () => {
    it('mixedContent without folder (experiencebundle)', () => {
      runTest(testData.mixedContent);
    });

    it('mixedContent in folder (Document)', () => {
      runTest(testData.mixedContentInFolder);
    });

    it('mixedContent w/ transformer (staticResource)', () => {
      runTest(testData.mixedContentTransformed);
    });
  });

  describe('strategy = bundle', () => {
    it('lwc', () => {
      runTest(testData.bundleLwc);
    });

    it('aura', () => {
      runTest(testData.bundleAura);
    });

    it('waveTemplate', () => {
      runTest(testData.bundleWave);
    });
  });

  describe('adapter = nondecomposed', () => {
    it('CustomLabels (explicit nondecomposed)', () => {
      runTest(testData.nonDecomposedExplicit);
    });

    it('Workflow (implicit nondecomposed)', () => {
      runTest(testData.nonDecomposedImplicit);
    });
  });

  describe('adapter = decomposed', () => {
    it('sanityCheck of childComponent behavior', () => {
      const component = {
        fullName: 'Stuff__c.Field__c',
        type: registryAccess.getTypeByName('CustomField'),
      };
      expect(component.type.children).to.equal(undefined);
      const topLevelType = component.type.children
        ? component.type
        : registryAccess.findType((t) => t.children && Object.keys(t.children.types).includes(component.type.id));
      expect(topLevelType).to.deep.equal(registryAccess.getTypeByName('CustomObject'));
    });

    it('parent object', () => {
      runTest(testData.decomposedParent);
    });

    it('child field', () => {
      runTest(testData.decomposedChild);
    });
  });

  describe('adapter = digitalExperience', () => {
    it('works for DEB - DigitalExperienceBundle', () => {
      runTest(testData.digitalExperienceBundle);
    });
    it('works for DE - DigitalExperience', () => {
      runTest(testData.digitalExperience);
    });
  });
});
