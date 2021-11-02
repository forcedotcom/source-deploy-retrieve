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
import { RegistryAccess } from '../../src/registry';
import { MetadataResolver } from '../../src/resolve';
import { VirtualTreeContainer } from '../../src/resolve/treeContainers';

chai.use(deepEqualInAnyOrder);

describe('generating virtual tree from component name/type', () => {
  const packageDir = path.normalize('force-app/main/default');
  const registryAccess = new RegistryAccess();

  it('works for default type (flow)', () => {
    // part 1: do you get the files you expect
    const component = { fullName: 'MyFlow', type: registryAccess.getTypeByName('Flow') };
    const filenames = filePathsFromMetadataComponent(component, packageDir);
    expect(filenames).to.deep.equal(
      ['flows/MyFlow.flow-meta.xml'].map((f) => path.join(packageDir, path.normalize(f)))
    );

    // part 2: are the files resolvable into the expected component?
    const resolver = new MetadataResolver(registryAccess, VirtualTreeContainer.fromFilePaths(filenames));

    const components = resolver.getComponentsFromPath(packageDir);
    expect(components).to.have.lengthOf(1);
    expect(components[0]).to.include({
      xml: filenames[0],
      name: component.fullName,
      type: component.type,
    });
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
      const component = { fullName: 'MyClass', type: registryAccess.getTypeByName('ApexClass') };
      const filenames = filePathsFromMetadataComponent(component, packageDir);
      expect(filenames).to.deep.equal(
        ['classes/MyClass.cls-meta.xml', 'classes/MyClass.cls'].map((f) => path.join(packageDir, path.normalize(f)))
      );

      const resolver = new MetadataResolver(registryAccess, VirtualTreeContainer.fromFilePaths(filenames));

      const components = resolver.getComponentsFromPath(packageDir);
      expect(components).to.have.lengthOf(1);
      expect(components[0]).to.include({
        xml: filenames.find((f) => f.endsWith('cls-meta.xml')),
        content: filenames.find((f) => f.endsWith('cls')),
        name: component.fullName,
        type: component.type,
      });
    });
    it('works for matchingContentFile with folder (emailTemplate and emailFolder)', () => {
      const component = { fullName: 'aFolder/someTemplate', type: registryAccess.getTypeByName('EmailTemplate') };
      const filenames = filePathsFromMetadataComponent(component, packageDir);
      expect(filenames).to.deep.equalInAnyOrder(
        [
          'email/aFolder.emailFolder-meta.xml',
          'email/aFolder/someTemplate.email',
          'email/aFolder/someTemplate.email-meta.xml',
        ].map((f) => path.join(packageDir, path.normalize(f)))
      );

      const resolver = new MetadataResolver(registryAccess, VirtualTreeContainer.fromFilePaths(filenames));

      const components = resolver.getComponentsFromPath(packageDir);
      expect(components).to.have.lengthOf(2);
      expect(components[1]).to.include({
        xml: filenames.find((f) => f.endsWith('email-meta.xml')),
        content: filenames.find((f) => f.endsWith('email')),
        name: component.fullName,
        type: component.type,
      });
      expect(components[0]).to.include({
        xml: filenames.find((f) => f.endsWith('emailFolder-meta.xml')),
        name: 'aFolder',
        type: registryAccess.getTypeByName('EmailFolder'),
      });
    });
  });

  describe('strategy = mixedContent', () => {
    it('mixedContent without folder (experiencebundle)', () => {
      const component = {
        fullName: 'E_Bikes1',
        type: registryAccess.getTypeByName('ExperienceBundle'),
      };
      const filenames = filePathsFromMetadataComponent(component, packageDir);
      expect(filenames).to.deep.equalInAnyOrder(
        ['experiences/E_Bikes1.site-meta.xml', 'experiences/E_Bikes1'].map((f) =>
          path.join(packageDir, path.normalize(f))
        )
      );
      const resolver = new MetadataResolver(registryAccess, VirtualTreeContainer.fromFilePaths(filenames));

      const components = resolver.getComponentsFromPath(packageDir);
      expect(components).to.have.lengthOf(1);
      expect(components[0]).to.include({
        xml: filenames.find((f) => f.endsWith('site-meta.xml')),
        name: 'E_Bikes1',
        type: component.type,
      });
    });
    it('mixedContent in folder (Document)', () => {
      const component = {
        fullName: 'MyDocumentFolder/MyDocumentName.png',
        type: registryAccess.getTypeByName('Document'),
      };
      const filenames = filePathsFromMetadataComponent(component, packageDir);
      expect(filenames).to.deep.equalInAnyOrder(
        [
          'documents/MyDocumentFolder.documentFolder-meta.xml',
          'documents/MyDocumentFolder/MyDocumentName.png',
          'documents/MyDocumentFolder/MyDocumentName.png-meta.xml',
        ].map((f) => path.join(packageDir, path.normalize(f)))
      );
      const resolver = new MetadataResolver(registryAccess, VirtualTreeContainer.fromFilePaths(filenames));

      const components = resolver.getComponentsFromPath(packageDir);
      expect(components).to.have.lengthOf(2);
      expect(components[1]).to.include({
        xml: filenames.find((f) => f.endsWith('png-meta.xml')),
        content: filenames.find((f) => f.endsWith('MyDocumentName.png')),
        name: 'MyDocumentFolder/MyDocumentName',
        type: component.type,
      });
      expect(components[0]).to.include({
        xml: filenames.find((f) => f.endsWith('documentFolder-meta.xml')),
        name: 'MyDocumentFolder',
        type: registryAccess.getTypeByName('DocumentFolder'),
      });
    });
    it('mixedContent w/ transformer (staticResource)', () => {
      const component = {
        fullName: 'zippedResource',
        type: registryAccess.getTypeByName('StaticResource'),
      };
      const filenames = filePathsFromMetadataComponent(component, packageDir);
      expect(filenames).to.deep.equalInAnyOrder(
        ['staticresources/zippedResource.resource-meta.xml', 'staticresources/zippedResource'].map((f) =>
          path.join(packageDir, path.normalize(f))
        )
      );
      const resolver = new MetadataResolver(registryAccess, VirtualTreeContainer.fromFilePaths(filenames));

      const components = resolver.getComponentsFromPath(packageDir);
      expect(components).to.have.lengthOf(1);

      expect(components[0]).to.include({
        xml: filenames.find((f) => f.endsWith('resource-meta.xml')),
        name: 'zippedResource',
        type: component.type,
      });
    });
  });

  describe('strategy = bundle', () => {
    it('lwc', () => {
      const component = {
        fullName: 'MyLwc',
        type: registryAccess.getTypeByName('LightningComponentBundle'),
      };
      const filenames = filePathsFromMetadataComponent(component, packageDir);
      expect(filenames).to.deep.equalInAnyOrder(
        ['lwc/MyLwc/MyLwc.js-meta.xml'].map((f) => path.join(packageDir, path.normalize(f)))
      );
      const resolver = new MetadataResolver(registryAccess, VirtualTreeContainer.fromFilePaths(filenames));

      const components = resolver.getComponentsFromPath(packageDir);
      expect(components).to.have.lengthOf(1);
      expect(components[0]).to.include({
        xml: filenames.find((f) => f.endsWith('js-meta.xml')),
        name: component.fullName,
        type: component.type,
      });
    });
    it('aura', () => {
      const component = {
        fullName: 'MyCmp',
        type: registryAccess.getTypeByName('AuraDefinitionBundle'),
      };
      const filenames = filePathsFromMetadataComponent(component, packageDir);
      expect(filenames).to.deep.equalInAnyOrder(
        ['aura/MyCmp/MyCmp.cmp-meta.xml'].map((f) => path.join(packageDir, path.normalize(f)))
      );
      const resolver = new MetadataResolver(registryAccess, VirtualTreeContainer.fromFilePaths(filenames));

      const components = resolver.getComponentsFromPath(packageDir);
      expect(components).to.have.lengthOf(1);
      expect(components[0]).to.include({
        xml: filenames.find((f) => f.endsWith('cmp-meta.xml')),
        name: component.fullName,
        type: component.type,
      });
    });
    it('waveTemplate', () => {
      const component = {
        fullName: 'WT',
        type: registryAccess.getTypeByName('WaveTemplateBundle'),
      };
      const filenames = filePathsFromMetadataComponent(component, packageDir);
      expect(filenames).to.deep.equalInAnyOrder(
        ['waveTemplates/WT/template-info.json'].map((f) => path.join(packageDir, path.normalize(f)))
      );
      const resolver = new MetadataResolver(registryAccess, VirtualTreeContainer.fromFilePaths(filenames));

      const components = resolver.getComponentsFromPath(packageDir);
      expect(components).to.have.lengthOf(1);
      expect(components[0]).to.include({
        content: path.join(packageDir, 'waveTemplates', component.fullName),
        name: component.fullName,
        type: component.type,
      });
    });
  });

  describe('adapter = nondecomposed', () => {
    const component = {
      fullName: 'CustomLabels',
      type: registryAccess.getTypeByName('CustomLabels'),
    };
    const filenames = filePathsFromMetadataComponent(component, packageDir);
    expect(filenames).to.deep.equal(
      ['labels/CustomLabels.labels-meta.xml'].map((f) => path.join(packageDir, path.normalize(f)))
    );
    const resolver = new MetadataResolver(registryAccess, VirtualTreeContainer.fromFilePaths(filenames));
    const components = resolver.getComponentsFromPath(packageDir);
    expect(components).to.have.lengthOf(1);
    expect(components[0]).to.include({
      xml: filenames[0],
      name: component.fullName,
      type: component.type,
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
      const component = {
        fullName: 'Stuff__c',
        type: registryAccess.getTypeByName('CustomObject'),
      };
      const filenames = filePathsFromMetadataComponent(component, packageDir);
      expect(filenames).to.deep.equal(
        ['objects/Stuff__c/Stuff__c.object-meta.xml'].map((f) => path.join(packageDir, path.normalize(f)))
      );
      const resolver = new MetadataResolver(registryAccess, VirtualTreeContainer.fromFilePaths(filenames));
      const components = resolver.getComponentsFromPath(packageDir);
      expect(components).to.have.lengthOf(1);
      expect(components[0]).to.include({
        xml: filenames[0],
        name: component.fullName,
        type: component.type,
      });
    });
    it('child field', () => {
      const component = {
        fullName: 'Stuff__c.Field__c',
        type: registryAccess.getTypeByName('CustomField'),
      };
      const filenames = filePathsFromMetadataComponent(component, packageDir);
      expect(filenames).to.deep.equalInAnyOrder(
        ['objects/Stuff__c/Stuff__c.object-meta.xml', 'objects/Stuff__c/fields/Field__c.field-meta.xml'].map((f) =>
          path.join(packageDir, path.normalize(f))
        )
      );
      const resolver = new MetadataResolver(registryAccess, VirtualTreeContainer.fromFilePaths(filenames));
      const components = resolver.getComponentsFromPath(packageDir);
      // it'll return the parent type
      expect(components[0]).to.include({
        xml: filenames[0],
        name: component.fullName.split('.')[0],
        type: registryAccess.getTypeByName('CustomObject'),
      });
    });
  });
});
