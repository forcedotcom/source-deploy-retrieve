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

describe.only('generating virtual tree from component name/type', () => {
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
    it('mixedContent without folder (experiencebundle)');
    it('mixedContent in folder (Document)');
    it('mixedContent w/ transformer (staticResource)');
  });

  describe('strategy = bundle', () => {
    it('aura');
    it('lwc');
    it('waveTemplate');
  });

  describe('adapter = decomposed', () => {});
});
