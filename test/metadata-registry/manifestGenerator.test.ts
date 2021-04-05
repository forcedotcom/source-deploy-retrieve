/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ManifestGenerator } from '../../src/resolve/manifestGenerator';
import { expect } from 'chai';
import { MetadataResolver, SourceComponent } from '../../src/resolve';
import { SinonSandbox, createSandbox } from 'sinon';
import * as fs from 'fs';
import * as path from 'path';
import { fail } from 'assert';
import { registry } from '../../src';

describe('ManifestGenerator', () => {
  let sandboxStub: SinonSandbox;
  const manifestGenerator = new ManifestGenerator();
  const apiVersion = registry.apiVersion;

  beforeEach(async () => {
    sandboxStub = createSandbox();
  });

  afterEach(() => {
    sandboxStub.restore();
  });

  it('should generate manifest for one type', () => {
    const component = {
      fullName: 'someName',
      type: { id: 'foobar', name: 'FooBar' },
    };
    let expectedManifest = '<?xml version="1.0" encoding="UTF-8"?>\n';
    expectedManifest += '<Package xmlns="http://soap.sforce.com/2006/04/metadata">\n';
    expectedManifest +=
      '  <types>\n    <members>someName</members>\n    <name>FooBar</name>\n  </types>\n';
    expectedManifest += `  <version>${apiVersion}</version>\n</Package>\n`;
    expect(manifestGenerator.createManifest([component])).to.equal(expectedManifest);
  });

  it('should generate manifest for multiple types', () => {
    const component1 = {
      fullName: 'apexClass1',
      type: { id: 'apexclass', name: 'ApexClass' },
    };
    const component2 = {
      fullName: 'apexTrigger1',
      type: { id: 'apextrigger', name: 'ApexTrigger' },
    };
    let expectedManifest = '<?xml version="1.0" encoding="UTF-8"?>\n';
    expectedManifest += '<Package xmlns="http://soap.sforce.com/2006/04/metadata">\n';
    expectedManifest +=
      '  <types>\n    <members>apexClass1</members>\n    <name>ApexClass</name>\n  </types>\n';
    expectedManifest +=
      '  <types>\n    <members>apexTrigger1</members>\n    <name>ApexTrigger</name>\n  </types>\n';
    expectedManifest += `  <version>${apiVersion}</version>\n</Package>\n`;
    expect(manifestGenerator.createManifest([component1, component2])).to.equal(expectedManifest);
  });

  it('should generate manifest for multiple components', () => {
    const component1 = {
      fullName: 'apexClass1',
      type: { id: 'apexclass', name: 'ApexClass' },
    };
    const component2 = {
      fullName: 'apexClass2',
      type: { id: 'apexclass', name: 'ApexClass' },
    };
    const component3 = {
      fullName: 'apexTrigger1',
      type: { id: 'apextrigger', name: 'ApexTrigger' },
    };
    let expectedManifest = '<?xml version="1.0" encoding="UTF-8"?>\n';
    expectedManifest += '<Package xmlns="http://soap.sforce.com/2006/04/metadata">\n';
    expectedManifest +=
      '  <types>\n    <members>apexClass1</members>\n    <members>apexClass2</members>\n    <name>ApexClass</name>\n  </types>\n';
    expectedManifest +=
      '  <types>\n    <members>apexTrigger1</members>\n    <name>ApexTrigger</name>\n  </types>\n';
    expectedManifest += `  <version>${apiVersion}</version>\n</Package>\n`;
    expect(manifestGenerator.createManifest([component1, component2, component3])).to.equal(
      expectedManifest
    );
  });

  it('should generate manifest for multiple components passed in different order', () => {
    const component1 = {
      fullName: 'apexClass1',
      type: { id: 'apexclass', name: 'ApexClass' },
    };
    const component2 = {
      fullName: 'apexClass2',
      type: { id: 'apexclass', name: 'ApexClass' },
    };
    const component3 = {
      fullName: 'apexTrigger1',
      type: { id: 'apextrigger', name: 'ApexTrigger' },
    };
    let expectedManifest = '<?xml version="1.0" encoding="UTF-8"?>\n';
    expectedManifest += '<Package xmlns="http://soap.sforce.com/2006/04/metadata">\n';
    expectedManifest +=
      '  <types>\n    <members>apexClass1</members>\n    <members>apexClass2</members>\n    <name>ApexClass</name>\n  </types>\n';
    expectedManifest +=
      '  <types>\n    <members>apexTrigger1</members>\n    <name>ApexTrigger</name>\n  </types>\n';
    expectedManifest += `  <version>${apiVersion}</version>\n</Package>\n`;
    expect(manifestGenerator.createManifest([component1, component3, component2])).to.equal(
      expectedManifest
    );
  });

  it('should generate manifest by overriding apiversion', () => {
    const component = {
      fullName: 'someName',
      type: { id: 'apexclass', name: 'ApexClass' },
    };
    let expectedManifest = '<?xml version="1.0" encoding="UTF-8"?>\n';
    expectedManifest += '<Package xmlns="http://soap.sforce.com/2006/04/metadata">\n';
    expectedManifest +=
      '  <types>\n    <members>someName</members>\n    <name>ApexClass</name>\n  </types>\n';
    expectedManifest += '  <version>45.0</version>\n</Package>\n';
    expect(manifestGenerator.createManifest([component], '45.0')).to.equal(expectedManifest);
  });

  const rootPath = path.join('file', 'path');
  const mdComponents = [
    SourceComponent.createVirtualComponent(
      {
        type: registry.types.apexclass,
        name: 'myTestClass',
        xml: path.join(rootPath, 'myTestClass.cls-meta.xml'),
        content: path.join(rootPath, 'myTestClass.cls'),
      },
      [
        {
          dirPath: rootPath,
          children: ['myTestClass.cls', 'myTestClass.cls-meta.xml'],
        },
      ]
    ),
  ];

  it('should successfully create a manifest with a sourcepath', () => {
    const resolver = new MetadataResolver();
    sandboxStub.stub(resolver, 'getComponentsFromPath').returns(mdComponents);
    const manifestGenerator = new ManifestGenerator(resolver);
    const writeFileStub = sandboxStub.stub(fs, 'writeFileSync');
    manifestGenerator.createManifestFromPath(
      path.join('file', 'path', 'myTestClass.cls-meta.xml'),
      path.join(rootPath, 'manifest', 'package.xml')
    );
    expect(writeFileStub.callCount).to.equal(1);
    expect(writeFileStub.getCall(0).args[0]).to.equal(
      path.join(rootPath, 'manifest', 'package.xml')
    );
  });

  it('should throw error when handling unexpected errors on creating a manifest with a sourcepath', () => {
    const resolver = new MetadataResolver();
    sandboxStub.stub(resolver, 'getComponentsFromPath').returns(mdComponents);
    const manifestGenerator = new ManifestGenerator(resolver);
    const writeFileStub = sandboxStub.stub(fs, 'writeFileSync');
    writeFileStub.onCall(0).throwsException('Unexpected error when creating file');
    const filePath = path.join(rootPath, 'myTestClass.cls-meta.xml');
    try {
      manifestGenerator.createManifestFromPath(
        filePath,
        path.join(rootPath, 'manifest', 'package.xml')
      );
      fail('Test should have thrown an error before this line');
    } catch (e) {
      expect(e.message).to.contain(
        `Unexpected error while creating manifest for '${filePath}'. Stack trace: Unexpected error when creating file`
      );
    }
  });
});
