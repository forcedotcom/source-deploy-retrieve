/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ManifestGenerator } from '../../src/metadata-registry/manifestGenerator';
import { MetadataComponent } from '../../src/types';
import { expect } from 'chai';
import { RegistryAccess } from '../../src/metadata-registry';
import { SinonSandbox, createSandbox } from 'sinon';
import * as fs from 'fs';
import * as path from 'path';
import * as stream from 'stream';
import { fail } from 'assert';

describe('ManifestGenerator', () => {
  let sandboxStub: SinonSandbox;
  const manifestGenerator = new ManifestGenerator();

  beforeEach(async () => {
    sandboxStub = createSandbox();
  });

  afterEach(() => {
    sandboxStub.restore();
  });

  it('should generate manifest for one type', () => {
    const component = {
      fullName: 'someName',
      type: { name: 'ApexClass' },
      xml: '',
      sources: []
    } as MetadataComponent;

    let expectedManifest = '<?xml version="1.0" encoding="UTF-8"?>\n';
    expectedManifest += '<Package xmlns="http://soap.sforce.com/2006/04/metadata">\n';
    expectedManifest +=
      '  <types>\n    <name>ApexClass</name>\n    <members>someName</members>\n  </types>\n';
    expectedManifest += '  <version>48.0</version>\n</Package>';

    expect(manifestGenerator.createManifest([component])).to.equal(expectedManifest);
  });

  it('should generate manifest for multiple types', () => {
    const component1 = {
      fullName: 'apexClass1',
      type: { name: 'ApexClass' },
      xml: '',
      sources: []
    } as MetadataComponent;

    const component2 = {
      fullName: 'apexTrigger1',
      type: { name: 'ApexTrigger' },
      xml: '',
      sources: []
    } as MetadataComponent;

    let expectedManifest = '<?xml version="1.0" encoding="UTF-8"?>\n';
    expectedManifest += '<Package xmlns="http://soap.sforce.com/2006/04/metadata">\n';
    expectedManifest +=
      '  <types>\n    <name>ApexClass</name>\n    <members>apexClass1</members>\n  </types>\n';
    expectedManifest +=
      '  <types>\n    <name>ApexTrigger</name>\n    <members>apexTrigger1</members>\n  </types>\n';
    expectedManifest += '  <version>48.0</version>\n</Package>';

    expect(manifestGenerator.createManifest([component1, component2])).to.equal(expectedManifest);
  });

  it('should generate manifest for multiple components', () => {
    const component1 = {
      fullName: 'apexClass1',
      type: { name: 'ApexClass' },
      xml: '',
      sources: []
    } as MetadataComponent;

    const component2 = {
      fullName: 'apexClass2',
      type: { name: 'ApexClass' },
      xml: '',
      sources: []
    } as MetadataComponent;

    const component3 = {
      fullName: 'apexTrigger1',
      type: { name: 'ApexTrigger' },
      xml: '',
      sources: []
    } as MetadataComponent;

    let expectedManifest = '<?xml version="1.0" encoding="UTF-8"?>\n';
    expectedManifest += '<Package xmlns="http://soap.sforce.com/2006/04/metadata">\n';
    expectedManifest +=
      '  <types>\n    <name>ApexClass</name>\n    <members>apexClass1</members>\n    <members>apexClass2</members>\n  </types>\n';
    expectedManifest +=
      '  <types>\n    <name>ApexTrigger</name>\n    <members>apexTrigger1</members>\n  </types>\n';
    expectedManifest += '  <version>48.0</version>\n</Package>';

    expect(manifestGenerator.createManifest([component1, component2, component3])).to.equal(
      expectedManifest
    );
  });

  it('should generate manifest for multiple components passed in different order', () => {
    const component1 = {
      fullName: 'apexClass1',
      type: { name: 'ApexClass' },
      xml: '',
      sources: []
    } as MetadataComponent;

    const component2 = {
      fullName: 'apexClass2',
      type: { name: 'ApexClass' },
      xml: '',
      sources: []
    } as MetadataComponent;

    const component3 = {
      fullName: 'apexTrigger1',
      type: { name: 'ApexTrigger' },
      xml: '',
      sources: []
    } as MetadataComponent;

    let expectedManifest = '<?xml version="1.0" encoding="UTF-8"?>\n';
    expectedManifest += '<Package xmlns="http://soap.sforce.com/2006/04/metadata">\n';
    expectedManifest +=
      '  <types>\n    <name>ApexClass</name>\n    <members>apexClass1</members>\n    <members>apexClass2</members>\n  </types>\n';
    expectedManifest +=
      '  <types>\n    <name>ApexTrigger</name>\n    <members>apexTrigger1</members>\n  </types>\n';
    expectedManifest += '  <version>48.0</version>\n</Package>';

    expect(manifestGenerator.createManifest([component1, component3, component2])).to.equal(
      expectedManifest
    );
  });

  it('should generate manifest by overriding apiversion', () => {
    const component = {
      fullName: 'someName',
      type: { name: 'ApexClass' },
      xml: '',
      sources: []
    } as MetadataComponent;

    let expectedManifest = '<?xml version="1.0" encoding="UTF-8"?>\n';
    expectedManifest += '<Package xmlns="http://soap.sforce.com/2006/04/metadata">\n';
    expectedManifest +=
      '  <types>\n    <name>ApexClass</name>\n    <members>someName</members>\n  </types>\n';
    expectedManifest += '  <version>45.0</version>\n</Package>';

    expect(manifestGenerator.createManifest([component], '45.0')).to.equal(expectedManifest);
  });

  it('should throw error for non valid type', () => {
    const component = {
      fullName: 'someName',
      type: { name: 'someveryunknowntype' },
      xml: '',
      sources: []
    } as MetadataComponent;
    try {
      manifestGenerator.createManifest([component]);
      expect.fail('should have failed');
    } catch (e) {
      expect(e.message).to.equal(
        "Missing metadata type definition in registry for id 'someveryunknowntype'"
      );
    }
  });

  it('should successfully create a manifest with a sourcepath', () => {
    const mdComponents: MetadataComponent[] = [
      {
        type: {
          name: 'ApexClass',
          directoryName: 'classes',
          inFolder: false,
          suffix: 'cls'
        },
        fullName: 'myTestClass',
        xml: path.join('file', 'path', 'myTestClass.cls-meta.xml'),
        sources: [path.join('file', 'path', 'myTestClass.cls')]
      }
    ];
    const registryAccess = new RegistryAccess();
    sandboxStub.stub(registryAccess, 'getComponentsFromPath').returns(mdComponents);
    sandboxStub.stub(fs, 'existsSync').returns(true);
    // @ts-ignore
    sandboxStub.stub(fs, 'lstatSync').returns({ isDirectory: () => false });
    const stubCreateMetadataFile = sandboxStub.stub(fs, 'createWriteStream');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    stubCreateMetadataFile.onCall(0).returns(new stream.PassThrough() as any);

    manifestGenerator.createManifestFromPath(
      path.join('file', 'path', 'myTestClass.cls-meta.xml'),
      path.join('file', 'path', 'manifest', 'package.xml')
    );

    expect(stubCreateMetadataFile.callCount).to.equal(1);
    expect(stubCreateMetadataFile.getCall(0).args[0]).to.equal(
      path.join('file', 'path', 'manifest', 'package.xml')
    );
  });

  it('should throw error when handling unexpected errors on creating a manifest with a sourcepath', () => {
    const mdComponents: MetadataComponent[] = [
      {
        type: {
          name: 'ApexClass',
          directoryName: 'classes',
          inFolder: false,
          suffix: 'cls'
        },
        fullName: 'myTestClass',
        xml: path.join('file', 'path', 'myTestClass.cls-meta.xml'),
        sources: [path.join('file', 'path', 'myTestClass.cls')]
      }
    ];
    const registryAccess = new RegistryAccess();
    sandboxStub.stub(registryAccess, 'getComponentsFromPath').returns(mdComponents);
    sandboxStub.stub(fs, 'existsSync').returns(true);
    // @ts-ignore
    sandboxStub.stub(fs, 'lstatSync').returns({ isDirectory: () => false });
    const stubCreateMetadataFile = sandboxStub.stub(fs, 'createWriteStream');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    stubCreateMetadataFile.onCall(0).throwsException('Unexpected error when creating file');
    const filePath = path.join('file', 'path', 'myTestClass.cls-meta.xml');
    try {
      manifestGenerator.createManifestFromPath(
        filePath,
        path.join('file', 'path', 'manifest', 'package.xml')
      );
      fail('Test should have thrown an error before this line');
    } catch (e) {
      expect(e.message).to.contain(
        `Unexpected error while creating manifest for '${filePath}'. Stack trace: Unexpected error when creating file`
      );
    }
  });
});
