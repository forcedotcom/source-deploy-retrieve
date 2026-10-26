/*
 * Copyright 2026, Salesforce, Inc.
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
import { dirname, join } from 'node:path';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fail } from 'node:assert';
import { Messages, SfError } from '@salesforce/core';
import { SinonStub } from 'sinon';
import fs from 'graceful-fs';
import { assert, expect } from 'chai';
import { TestContext } from '@salesforce/core/testSetup';
import { xmlInFolder, digitalExperienceBundle } from '../mock';
import * as streams from '../../src/convert/streams';
import { COMPONENTS } from '../mock/type-constants/documentFolderConstant';
import { ComponentSet, DestructiveChangesType, MetadataConverter, registry, SourceComponent } from '../../src';
import * as coverage from '../../src/registry/coverage';
import {
  DECOMPOSED_CHILD_COMPONENT_1,
  DECOMPOSED_CHILD_COMPONENT_2,
} from '../mock/type-constants/customObjectConstant';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/source-deploy-retrieve', 'sdr');

describe('MetadataConverter', () => {
  const $$ = new TestContext();

  let mkdirSyncStub: SinonStub;
  let pipelineStub: SinonStub;
  let writeFileStub: SinonStub;

  const converter = new MetadataConverter();
  const components = xmlInFolder.COMPONENTS;
  const packageName = 'test';
  const outputDirectory = join('path', 'to', 'output');
  const packageOutput = join(outputDirectory, packageName);
  const testApiversion = '50.0';

  /* eslint-disable-next-line  @typescript-eslint/no-explicit-any */
  function validatePipelineArgs(mockPipeline: any, targetFormat = 'metadata'): void {
    expect(mockPipeline.firstCall.args[2] instanceof streams.ComponentConverter).to.be.true;
    expect(mockPipeline.firstCall.args[2].targetFormat).to.equal(targetFormat);
    expect(mockPipeline.firstCall.args[3] instanceof streams.ComponentWriter).to.be.true;
  }

  beforeEach(() => {
    mkdirSyncStub = $$.SANDBOX.stub(fs, 'mkdirSync');
    const mockPipeline = $$.SANDBOX.stub().resolves();
    pipelineStub = $$.SANDBOX.stub(streams, 'getPipeline').returns(mockPipeline);
    writeFileStub = $$.SANDBOX.stub(fs.promises, 'writeFile').resolves();
    $$.SANDBOX.stub(fs, 'createWriteStream');
    $$.SANDBOX.stub(coverage, 'getCurrentApiVersion').resolves(50);
  });

  it('should generate package name using timestamp when option omitted', async () => {
    const timestamp = 123_456;
    const packagePath = join(outputDirectory, `${MetadataConverter.DEFAULT_PACKAGE_PREFIX}_${timestamp}`);
    $$.SANDBOX.stub(Date, 'now').returns(timestamp);
    const mockPipeline = $$.SANDBOX.stub().resolves();
    pipelineStub.returns(mockPipeline);

    await converter.convert(components, 'metadata', {
      type: 'directory',
      outputDirectory,
    });

    expect(mockPipeline.firstCall.args[3].rootDestination).to.equal(packagePath);
  });

  it('should convert to specified output dir', async () => {
    const mockPipeline = $$.SANDBOX.stub().resolves();
    pipelineStub.returns(mockPipeline);

    await converter.convert(components, 'metadata', {
      type: 'directory',
      outputDirectory,
      genUniqueDir: false,
    });

    expect(mockPipeline.firstCall.args[3].rootDestination).to.equal(outputDirectory);
  });

  it('should throw ConversionError when an error occurs', async () => {
    const error = new Error('whoops!');
    const expectedError = new SfError(
      messages.getMessage('error_failed_convert', [error.message]),
      'ConversionError',
      [],
      error
    );
    const mockPipeline = $$.SANDBOX.stub().rejects(error);
    pipelineStub.returns(mockPipeline);

    try {
      await converter.convert(components, 'metadata', {
        type: 'directory',
        outputDirectory,
      });
      assert.fail('an error should have been thrown');
    } catch (e) {
      assert(e instanceof Error);
      expect(e.message).to.equal(expectedError.message);
      expect(e.name).to.equal(expectedError.name);
    }
  });

  describe('Directory Output', () => {
    it('should ensure directory exists before starting conversion', async () => {
      await converter.convert(components, 'metadata', {
        type: 'directory',
        outputDirectory,
        packageName,
      });

      expect(mkdirSyncStub.calledBefore(pipelineStub)).to.be.true;
      expect(mkdirSyncStub.firstCall.args[0]).to.equal(packageOutput);
    });

    it('should create conversion pipeline with proper stream configuration', async () => {
      const mockPipeline = $$.SANDBOX.stub().resolves();
      pipelineStub.returns(mockPipeline);

      await converter.convert(components, 'metadata', {
        type: 'directory',
        outputDirectory,
        packageName,
      });

      validatePipelineArgs(mockPipeline);
      expect(mockPipeline.firstCall.args[3] instanceof streams.StandardWriter).to.be.true;
      expect(mockPipeline.firstCall.args[3].rootDestination).to.equal(packageOutput);
    });

    it('should create conversion pipeline with normalized output directory', async () => {
      const mockPipeline = $$.SANDBOX.stub().resolves();
      pipelineStub.returns(mockPipeline);

      await converter.convert(components, 'metadata', {
        type: 'directory',
        outputDirectory: './',
        packageName,
      });

      validatePipelineArgs(mockPipeline);
      expect(mockPipeline.firstCall.args[3] instanceof streams.StandardWriter).to.be.true;
      expect(mockPipeline.firstCall.args[3].rootDestination).to.equal(packageName);
    });

    it('should return packagePath in result', async () => {
      const result = await converter.convert(components, 'metadata', {
        type: 'directory',
        outputDirectory,
        packageName,
      });

      expect(result.packagePath).to.equal(packageOutput);
    });

    it('should write manifest for metadata format conversion', async () => {
      const timestamp = 123_456;
      const packagePath = join(outputDirectory, `${MetadataConverter.DEFAULT_PACKAGE_PREFIX}_${timestamp}`);
      $$.SANDBOX.stub(Date, 'now').returns(timestamp);
      const expectedContents = await new ComponentSet(components).getPackageXml();

      await converter.convert(components, 'metadata', { type: 'directory', outputDirectory });

      expect(writeFileStub.calledBefore(pipelineStub)).to.be.true;
      expect(writeFileStub.firstCall.args).to.deep.equal([
        join(packagePath, MetadataConverter.PACKAGE_XML_FILE),
        expectedContents,
      ]);
    });

    it('should write destructive changes post manifest when ComponentSet has deletes marked for post', async () => {
      const timestamp = 123_456;
      const packagePath = join(outputDirectory, `${MetadataConverter.DEFAULT_PACKAGE_PREFIX}_${timestamp}`);
      $$.SANDBOX.stub(Date, 'now').returns(timestamp);
      const component1 = new SourceComponent({
        name: DECOMPOSED_CHILD_COMPONENT_1.name,
        type: DECOMPOSED_CHILD_COMPONENT_1.type,
        xml: DECOMPOSED_CHILD_COMPONENT_1.xml,
      });
      component1.setMarkedForDelete(DestructiveChangesType.POST);
      const component2 = new SourceComponent({
        name: DECOMPOSED_CHILD_COMPONENT_2.name,
        type: DECOMPOSED_CHILD_COMPONENT_2.type,
        xml: DECOMPOSED_CHILD_COMPONENT_2.xml,
      });
      const compSet = new ComponentSet([component1, component2]);
      const expectedDestructiveContents = await compSet.getPackageXml(undefined, DestructiveChangesType.POST);
      const expectedContents = await compSet.getPackageXml();

      await converter.convert(compSet, 'metadata', { type: 'directory', outputDirectory });

      expect(writeFileStub.calledBefore(pipelineStub)).to.be.true;
      expect(writeFileStub.firstCall.args).to.deep.equal([
        join(packagePath, MetadataConverter.PACKAGE_XML_FILE),
        expectedContents,
      ]);
      expect(writeFileStub.secondCall.args).to.deep.equal([
        join(packagePath, MetadataConverter.DESTRUCTIVE_CHANGES_POST_XML_FILE),
        expectedDestructiveContents,
      ]);
    });

    it('should write destructive changes pre manifest when ComponentSet has deletes', async () => {
      const timestamp = 123_456;
      const packagePath = join(outputDirectory, `${MetadataConverter.DEFAULT_PACKAGE_PREFIX}_${timestamp}`);
      $$.SANDBOX.stub(Date, 'now').returns(timestamp);
      const component1 = new SourceComponent({
        name: DECOMPOSED_CHILD_COMPONENT_1.name,
        type: DECOMPOSED_CHILD_COMPONENT_1.type,
        xml: DECOMPOSED_CHILD_COMPONENT_1.xml,
      });
      component1.setMarkedForDelete(DestructiveChangesType.PRE);
      const component2 = new SourceComponent({
        name: DECOMPOSED_CHILD_COMPONENT_2.name,
        type: DECOMPOSED_CHILD_COMPONENT_2.type,
        xml: DECOMPOSED_CHILD_COMPONENT_2.xml,
      });
      const compSet = new ComponentSet([component1, component2]);
      compSet.setDestructiveChangesType(DestructiveChangesType.PRE);
      const expectedDestructiveContents = await compSet.getPackageXml(undefined, DestructiveChangesType.PRE);
      const expectedContents = await compSet.getPackageXml();

      await converter.convert(compSet, 'metadata', { type: 'directory', outputDirectory });

      expect(writeFileStub.calledBefore(pipelineStub)).to.be.true;
      expect(writeFileStub.firstCall.args).to.deep.equal([
        join(packagePath, MetadataConverter.PACKAGE_XML_FILE),
        expectedContents,
      ]);
      expect(writeFileStub.secondCall.args).to.deep.equal([
        join(packagePath, MetadataConverter.DESTRUCTIVE_CHANGES_PRE_XML_FILE),
        expectedDestructiveContents,
      ]);
    });

    it('should write manifest for metadata format conversion with sourceApiVersion', async () => {
      const timestamp = 123_456;
      const packagePath = join(outputDirectory, `${MetadataConverter.DEFAULT_PACKAGE_PREFIX}_${timestamp}`);
      $$.SANDBOX.stub(Date, 'now').returns(timestamp);
      const compSet = new ComponentSet(components);
      compSet.sourceApiVersion = testApiversion;
      const expectedContents = await compSet.getPackageXml();

      await converter.convert(compSet, 'metadata', { type: 'directory', outputDirectory });

      expect(writeFileStub.calledBefore(pipelineStub)).to.be.true;
      expect(writeFileStub.firstCall.args).to.deep.equal([
        join(packagePath, MetadataConverter.PACKAGE_XML_FILE),
        expectedContents,
      ]);
      expect(expectedContents).to.contain(`<version>${testApiversion}</version>`);
    });

    it('should write the fullName entry when packageName is provided', async () => {
      const timestamp = 123_456;
      const examplePackageName = 'examplePackage';
      const packagePath = join(outputDirectory, examplePackageName);
      $$.SANDBOX.stub(Date, 'now').returns(timestamp);
      const cs = new ComponentSet(components);
      cs.fullName = examplePackageName;
      const expectedContents = await cs.getPackageXml();

      await converter.convert(components, 'metadata', {
        type: 'directory',
        outputDirectory,
        packageName: examplePackageName,
      });

      expect(writeFileStub.calledBefore(pipelineStub)).to.be.true;
      expect(writeFileStub.firstCall.args).to.deep.equal([
        join(packagePath, MetadataConverter.PACKAGE_XML_FILE),
        expectedContents,
      ]);
    });

    it('should not write manifest for source format conversion', async () => {
      await converter.convert(components, 'source', { type: 'directory', outputDirectory });

      expect(writeFileStub.notCalled).to.be.true;
    });
  });

  describe('Profile metadata', () => {
    let tempDirectory: string;

    beforeEach(() => {
      tempDirectory = mkdtempSync(join(tmpdir(), 'sdr-profile-'));
      $$.SANDBOX.restore();
    });

    afterEach(() => rmSync(tempDirectory, { recursive: true, force: true }));

    it('merges profile fragments from multiple source locations', async () => {
      const firstProfile = join(tempDirectory, 'first', 'profiles', 'Admin.profile-meta.xml');
      const secondProfile = join(tempDirectory, 'second', 'profiles', 'Admin.profile-meta.xml');
      for (const profile of [firstProfile, secondProfile]) {
        fs.mkdirSync(dirname(profile), { recursive: true });
      }
      writeFileSync(
        firstProfile,
        '<?xml version="1.0" encoding="UTF-8"?><Profile xmlns="http://soap.sforce.com/2006/04/metadata"><custom>true</custom><layoutAssignments><layout>Account-Account Layout</layout><recordType>Account.Business</recordType></layoutAssignments></Profile>'
      );
      writeFileSync(
        secondProfile,
        '<?xml version="1.0" encoding="UTF-8"?><Profile xmlns="http://soap.sforce.com/2006/04/metadata"><custom>true</custom><layoutAssignments><recordType>Account.Business</recordType><layout>Account-Account Layout</layout></layoutAssignments><layoutAssignments><layout>Contact-Contact Layout</layout><recordType>Contact.Business</recordType></layoutAssignments><layoutAssignments><layout>Account-Other Layout</layout><recordType>Account.Business</recordType></layoutAssignments></Profile>'
      );

      const profileType = registry.types.profile;
      const profileComponents = [
        new SourceComponent({ name: 'Admin', type: profileType, xml: firstProfile }),
        new SourceComponent({ name: 'Admin', type: profileType, xml: secondProfile }),
      ];

      await new MetadataConverter().convert(profileComponents, 'metadata', {
        type: 'directory',
        outputDirectory: tempDirectory,
        packageName: 'mdapi',
      });

      const output = readFileSync(join(tempDirectory, 'mdapi', 'profiles', 'Admin.profile'), 'utf8');
      expect(output).to.include('<layout>Account-Account Layout</layout>');
      expect(output).to.include('<layout>Contact-Contact Layout</layout>');
      expect(output.match(/<custom>true<\/custom>/g)).to.have.length(1);
      expect(output.match(/<layout>Account-Account Layout<\/layout>/g)).to.have.length(1);
      expect(output.indexOf('Account-Account Layout')).to.be.lessThan(output.indexOf('Contact-Contact Layout'));
      expect(output.indexOf('Contact-Contact Layout')).to.be.lessThan(output.indexOf('Account-Other Layout'));
    });

    const writeProfile = (directory: string, body: string, metadata = false): SourceComponent => {
      const xml = join(tempDirectory, directory, 'profiles', `Admin.profile${metadata ? '' : '-meta.xml'}`);
      fs.mkdirSync(dirname(xml), { recursive: true });
      writeFileSync(xml, `<Profile xmlns="http://soap.sforce.com/2006/04/metadata">${body}</Profile>`);
      return new SourceComponent({ name: 'Admin', type: registry.types.profile, xml });
    };

    for (const [tag, first, second] of [
      ['custom', 'true', 'false'],
      ['description', 'First', 'Second'],
      ['loginHours', '<mondayStart>0</mondayStart>', '<mondayStart>60</mondayStart>'],
      ['userLicense', 'Salesforce', 'Salesforce Platform'],
    ]) {
      it(`rejects conflicting singleton ${tag} with Profile and source paths`, async () => {
        const fragments = [
          writeProfile('first', `<${tag}>${first}</${tag}>`),
          writeProfile('second', `<${tag}>${second}</${tag}>`),
        ];
        let error: unknown;
        try {
          await new MetadataConverter().convert(fragments, 'metadata', {
            type: 'directory',
            outputDirectory: tempDirectory,
            packageName: 'mdapi',
          });
        } catch (e) {
          error = e;
        }
        assert(error instanceof Error, 'conflicting singleton must fail conversion');
        expect(error.name).to.equal('ConversionError');
        for (const detail of ['Admin', tag, ...fragments.map((fragment) => fragment.xml)]) {
          expect(error.message).to.include(detail);
        }
      });
    }

    for (const existingDefault of [false, true]) {
      it(`updates owned entries and routes new retrieved entries to ${
        existingDefault ? 'existing' : 'new'
      } default Profile`, async () => {
        const custom = '<custom>true</custom>';
        const account =
          '<layoutAssignments><layout>Account-Account Layout</layout><recordType>Account.Business</recordType></layoutAssignments>';
        const updatedAccount =
          '<layoutAssignments><layout>Account-Updated Layout</layout><recordType>Account.Business</recordType></layoutAssignments>';
        const contact = '<layoutAssignments><layout>Contact-Contact Layout</layout></layoutAssignments>';
        const incoming = writeProfile(
          'retrieved',
          `${custom}${updatedAccount}${contact}<description>New</description>`,
          true
        );
        const fragments = [writeProfile('first', custom + account), writeProfile('second', custom + contact)];
        if (existingDefault)
          writeProfile(join('default', 'main', 'default'), `${custom}<userLicense>Salesforce</userLicense>`);
        const defaultDirectory = join(tempDirectory, 'default');
        const result = await new MetadataConverter().convert([incoming], 'source', {
          type: 'merge',
          mergeWith: fragments,
          defaultDirectory,
        });
        const firstOutput = readFileSync(fragments[0].xml!, 'utf8');
        const secondOutput = readFileSync(fragments[1].xml!, 'utf8');
        expect(firstOutput).to.include('<layout>Account-Updated Layout</layout>');
        expect(firstOutput).not.to.include('Account-Account Layout');
        expect(secondOutput).to.include('<layout>Contact-Contact Layout</layout>');
        expect(firstOutput.match(/<custom>/g)).to.have.length(1);
        expect(secondOutput.match(/<custom>/g)).to.have.length(1);
        const destination = join(defaultDirectory, 'main', 'default', 'profiles', 'Admin.profile-meta.xml');
        expect(result.converted?.map((component) => component.xml)).to.have.members([fragments[0].xml, destination]);
        const output = readFileSync(destination, 'utf8');
        expect(output).to.include('<description>New</description>');
        expect(output).not.to.include('<layoutAssignments>');
        expect(output.match(/<custom>/g) ?? []).to.have.length(existingDefault ? 1 : 0);
        if (existingDefault) expect(output).to.include('<userLicense>Salesforce</userLicense>');
      });
    }

    it('round-trips retrieved Profile fragments without duplicate singleton tags', async () => {
      const incoming = writeProfile(
        'retrieved',
        '<custom>true</custom><layoutAssignments><layout>Account-Updated Layout</layout><recordType>Account.Business</recordType></layoutAssignments><description>New</description>',
        true
      );
      const fragments = [
        writeProfile(
          'first',
          '<custom>true</custom><layoutAssignments><layout>Account-Account Layout</layout><recordType>Account.Business</recordType></layoutAssignments>'
        ),
        writeProfile('second', '<custom>true</custom><userLicense>Salesforce</userLicense>'),
      ];
      const defaultDirectory = join(tempDirectory, 'default');
      await new MetadataConverter().convert([incoming], 'source', {
        type: 'merge',
        mergeWith: fragments,
        defaultDirectory,
      });
      expect(readFileSync(fragments[0].xml!, 'utf8')).to.include('<layout>Account-Updated Layout</layout>');
      const defaultProfileXml = join(tempDirectory, 'third', 'profiles', 'Admin.profile-meta.xml');
      fs.mkdirSync(dirname(defaultProfileXml), { recursive: true });
      writeFileSync(
        defaultProfileXml,
        readFileSync(join(defaultDirectory, 'main', 'default', 'profiles', 'Admin.profile-meta.xml'))
      );
      const defaultProfile = new SourceComponent({
        name: 'Admin',
        type: registry.types.profile,
        xml: defaultProfileXml,
      });
      const retrievedFragments = fragments.map(
        ({ xml }) => new SourceComponent({ name: 'Admin', type: registry.types.profile, xml })
      );
      await new MetadataConverter().convert([...retrievedFragments, defaultProfile], 'metadata', {
        type: 'directory',
        outputDirectory: tempDirectory,
        packageName: 'round-trip',
      });
      const output = readFileSync(join(tempDirectory, 'round-trip', 'profiles', 'Admin.profile'), 'utf8');
      expect(output.match(/<custom>true<\/custom>/g)).to.have.length(1);
      expect(output).to.include('<layout>Account-Updated Layout</layout>');
      expect(output).to.include('<description>New</description>');
      expect(output).to.include('<userLicense>Salesforce</userLicense>');
    });

    it('updates every Profile fragment that owns a changed singleton', async () => {
      const incoming = writeProfile('retrieved', '<custom>false</custom>', true);
      const fragments = [
        writeProfile('first', '<custom>true</custom>'),
        writeProfile('second', '<custom>true</custom>'),
      ];
      const defaultDirectory = join(tempDirectory, 'default');
      const result = await new MetadataConverter().convert([incoming], 'source', {
        type: 'merge',
        mergeWith: fragments,
        defaultDirectory,
      });
      for (const fragment of fragments) {
        const output = readFileSync(fragment.xml!, 'utf8');
        expect(output).to.include('<custom>false</custom>');
        expect(output).not.to.include('<custom>true</custom>');
      }
      expect(result.converted?.map((component) => component.xml)).to.have.members(fragments.map(({ xml }) => xml));
      expect(existsSync(join(defaultDirectory, 'main', 'default', 'profiles', 'Admin.profile-meta.xml'))).to.be.false;
    });

    it('keeps distinct record type layout assignments when one changes', async () => {
      const incoming = writeProfile(
        'retrieved',
        '<layoutAssignments><layout>Account-Business Updated</layout><recordType>Account.Business</recordType></layoutAssignments><layoutAssignments><layout>Account-Person Layout</layout><recordType>Account.Person</recordType></layoutAssignments>',
        true
      );
      const fragment = writeProfile(
        'first',
        '<layoutAssignments><layout>Account-Business Layout</layout><recordType>Account.Business</recordType></layoutAssignments><layoutAssignments><layout>Account-Person Layout</layout><recordType>Account.Person</recordType></layoutAssignments>'
      );
      await new MetadataConverter().convert([incoming], 'source', {
        type: 'merge',
        mergeWith: [fragment],
        defaultDirectory: join(tempDirectory, 'default'),
      });
      const output = readFileSync(fragment.xml!, 'utf8');
      expect(output).to.include('<layout>Account-Business Updated</layout>');
      expect(output).to.include('<recordType>Account.Business</recordType>');
      expect(output).to.include('<layout>Account-Person Layout</layout>');
      expect(output).to.include('<recordType>Account.Person</recordType>');
    });

    it('does not write or create a default Profile when all retrieved entries are owned', async () => {
      const fragments = [
        writeProfile('first', '<custom>true</custom>'),
        writeProfile('second', '<description>Owned</description>'),
      ];
      const originals = fragments.map((fragment) => readFileSync(fragment.xml!, 'utf8'));
      const incoming = writeProfile('retrieved', '<custom>true</custom><description>Owned</description>', true);
      const defaultDirectory = join(tempDirectory, 'default');
      const result = await new MetadataConverter().convert([incoming], 'source', {
        type: 'merge',
        mergeWith: fragments,
        defaultDirectory,
      });
      expect(result.converted).to.deep.equal([]);
      expect(existsSync(join(defaultDirectory, 'main', 'default', 'profiles', 'Admin.profile-meta.xml'))).to.be.false;
      fragments.forEach((fragment, index) => expect(readFileSync(fragment.xml!, 'utf8')).to.equal(originals[index]));
    });

    it('writes the conventional default Profile when no local Profile matches', async () => {
      const incoming = writeProfile('retrieved', '<custom>true</custom><description>New</description>', true);
      const defaultDirectory = join(tempDirectory, 'default');
      const result = await new MetadataConverter().convert([incoming], 'source', {
        type: 'merge',
        mergeWith: [],
        defaultDirectory,
      });
      const destination = join(defaultDirectory, 'main', 'default', 'profiles', 'Admin.profile-meta.xml');
      expect(result.converted?.map((component) => component.xml)).to.deep.equal([destination]);
      expect(readFileSync(destination, 'utf8')).to.include('<custom>true</custom>');
    });
  });

  describe('Zip Output', () => {
    it('should ensure directory exists before starting conversion', async () => {
      const zipPath = packageOutput + '.zip';
      await converter.convert(components, 'metadata', {
        type: 'zip',
        outputDirectory,
        packageName,
      });

      expect(mkdirSyncStub.calledBefore(pipelineStub)).to.be.true;
      expect(mkdirSyncStub.firstCall.args[0]).to.equal(dirname(zipPath));
    });

    it('should convert to specified output dir', async () => {
      const zipPath = outputDirectory + '.zip';
      const testBuffer = Buffer.from('🥔');
      $$.SANDBOX.stub(streams.ZipWriter.prototype, 'buffer').value(testBuffer);
      await converter.convert(components, 'metadata', {
        type: 'zip',
        outputDirectory,
        genUniqueDir: false,
      });

      expect(mkdirSyncStub.calledBefore(pipelineStub)).to.be.true;
      expect(writeFileStub.firstCall.args[0]).to.equal(zipPath);
      expect(writeFileStub.firstCall.args[1]).to.deep.equal(testBuffer);
    });

    it('should not return zipBuffer result when outputDirectory is specified', async () => {
      const testBuffer = Buffer.from('🥔');
      $$.SANDBOX.stub(streams.ZipWriter.prototype, 'buffer').value(testBuffer);
      const result = await converter.convert(components, 'metadata', {
        type: 'zip',
        outputDirectory,
        genUniqueDir: false,
      });

      expect(result.zipBuffer).to.be.undefined;
    });

    it('should return zipBuffer result for in-memory configuration', async () => {
      const testBuffer = Buffer.from('oh hi mark');
      $$.SANDBOX.stub(streams.ZipWriter.prototype, 'buffer').value(testBuffer);

      const result = await converter.convert(components, 'metadata', { type: 'zip' });

      expect(result.zipBuffer).to.deep.equal(testBuffer);
      expect(result.zipFileCount).to.equal(1);
    });

    it('should return packagePath in result', async () => {
      const result = await converter.convert(components, 'metadata', {
        type: 'zip',
        outputDirectory,
        packageName,
      });

      expect(result.packagePath).to.equal(`${packageOutput}.zip`);
    });

    it('should write manifest for metadata format conversion', async () => {
      const expectedContents = await new ComponentSet(components).getPackageXml();
      const addToZipStub = $$.SANDBOX.stub(streams.ZipWriter.prototype, 'addToZip');

      await converter.convert(components, 'metadata', { type: 'zip' });

      expect(addToZipStub.calledBefore(pipelineStub)).to.be.true;
      expect(addToZipStub.firstCall.args).to.deep.equal([expectedContents, MetadataConverter.PACKAGE_XML_FILE]);
    });

    it('should write destructive changes post manifest when ComponentSet has deletes', async () => {
      const component1 = new SourceComponent({
        name: DECOMPOSED_CHILD_COMPONENT_1.name,
        type: DECOMPOSED_CHILD_COMPONENT_1.type,
        xml: DECOMPOSED_CHILD_COMPONENT_1.xml,
      });
      component1.setMarkedForDelete();
      const component2 = new SourceComponent({
        name: DECOMPOSED_CHILD_COMPONENT_2.name,
        type: DECOMPOSED_CHILD_COMPONENT_2.type,
        xml: DECOMPOSED_CHILD_COMPONENT_2.xml,
      });
      const compSet = new ComponentSet([component1, component2]);
      compSet.apiVersion = testApiversion;

      const expectedDestructiveContents = await compSet.getPackageXml(undefined, DestructiveChangesType.POST);
      const expectedContents = await compSet.getPackageXml();
      const addToZipStub = $$.SANDBOX.stub(streams.ZipWriter.prototype, 'addToZip');

      await converter.convert(compSet, 'metadata', { type: 'zip' });

      expect(addToZipStub.calledBefore(pipelineStub)).to.be.true;
      expect(addToZipStub.firstCall.args).to.deep.equal([expectedContents, MetadataConverter.PACKAGE_XML_FILE]);
      expect(addToZipStub.secondCall.args).to.deep.equal([
        expectedDestructiveContents,
        MetadataConverter.DESTRUCTIVE_CHANGES_POST_XML_FILE,
      ]);
    });

    it('should write destructive changes pre manifest when ComponentSet has deletes marked for pre', async () => {
      const component1 = new SourceComponent({
        name: DECOMPOSED_CHILD_COMPONENT_1.name,
        type: DECOMPOSED_CHILD_COMPONENT_1.type,
        xml: DECOMPOSED_CHILD_COMPONENT_1.xml,
      });
      component1.setMarkedForDelete(DestructiveChangesType.PRE);
      const component2 = new SourceComponent({
        name: DECOMPOSED_CHILD_COMPONENT_2.name,
        type: DECOMPOSED_CHILD_COMPONENT_2.type,
        xml: DECOMPOSED_CHILD_COMPONENT_2.xml,
      });
      const compSet = new ComponentSet([component1, component2]);
      compSet.apiVersion = testApiversion;
      compSet.setDestructiveChangesType(DestructiveChangesType.PRE);
      const expectedDestructiveContents = await compSet.getPackageXml(4, DestructiveChangesType.PRE);
      const expectedContents = await compSet.getPackageXml();
      const addToZipStub = $$.SANDBOX.stub(streams.ZipWriter.prototype, 'addToZip');

      await converter.convert(compSet, 'metadata', { type: 'zip' });

      expect(addToZipStub.calledBefore(pipelineStub)).to.be.true;
      expect(addToZipStub.firstCall.args).to.deep.equal([expectedContents, MetadataConverter.PACKAGE_XML_FILE]);
      expect(addToZipStub.secondCall.args).to.deep.equal([
        expectedDestructiveContents,
        MetadataConverter.DESTRUCTIVE_CHANGES_PRE_XML_FILE,
      ]);
    });

    it('should not write manifest for source format conversion', async () => {
      const addToZipStub = $$.SANDBOX.stub(streams.ZipWriter.prototype, 'addToZip');

      await converter.convert(components, 'source', { type: 'zip' });

      expect(addToZipStub.notCalled).to.be.true;
    });
  });

  describe('Merge Output', () => {
    const defaultDirectory = join('path', 'to', 'default');

    it('should throw error if merge config provided for metadata target format', async () => {
      const errorToWrap = new SfError(messages.getMessage('error_merge_metadata_target_unsupported'));
      const expectedError = new SfError(
        messages.getMessage('error_failed_convert', [errorToWrap.message]),
        'ConversionError',
        [],
        errorToWrap
      );

      try {
        await converter.convert(components, 'metadata', {
          type: 'merge',
          defaultDirectory,
          mergeWith: COMPONENTS,
        });
        fail(`should have thrown a ${expectedError.name} error`);
      } catch (e) {
        assert(e instanceof SfError);
        expect(e.name).to.equal('ConversionError');
        expect(e.message).to.equal(expectedError.message);
      }
    });

    it('should create conversion pipeline with proper configuration', async () => {
      const mockPipeline = $$.SANDBOX.stub().resolves();
      pipelineStub.returns(mockPipeline);

      await converter.convert(components, 'source', {
        type: 'merge',
        defaultDirectory,
        mergeWith: COMPONENTS,
      });

      validatePipelineArgs(mockPipeline, 'source');
      expect(mockPipeline.firstCall.args[2].mergeSet).to.deep.equal(new ComponentSet(COMPONENTS));
      expect(mockPipeline.firstCall.args[3].rootDestination).to.equal(defaultDirectory);
    });

    it('should create conversion pipeline with addressable components', async () => {
      const mockPipeline = $$.SANDBOX.stub().resolves();
      pipelineStub.returns(mockPipeline);

      components.push({
        type: registry.types.customobjecttranslation.children?.types.customfieldtranslation,
        name: 'myFieldTranslation',
      } as SourceComponent);

      expect(components.length).to.equal(4);
      await converter.convert(components, 'source', {
        type: 'merge',
        defaultDirectory,
        mergeWith: COMPONENTS,
      });

      validatePipelineArgs(mockPipeline, 'source');

      // pop off the CFT that should be filtered off for the assertion
      components.pop();
      expect(mockPipeline.firstCall.args[3].rootDestination).to.equal(defaultDirectory);
    });

    it('should ensure the merge set contains child DE instead of parent DEB', async () => {
      const mockPipeline = $$.SANDBOX.stub().resolves();
      pipelineStub.returns(mockPipeline);

      assert(digitalExperienceBundle.DE_COMPONENT.parent?.xml);

      await converter.convert(new ComponentSet([digitalExperienceBundle.DE_COMPONENT]), 'source', {
        type: 'merge',
        defaultDirectory,
        mergeWith: [digitalExperienceBundle.DE_COMPONENT],
      });

      validatePipelineArgs(mockPipeline, 'source');
      expect(mockPipeline.firstCall.args[2].mergeSet).to.deep.equal(
        new ComponentSet([digitalExperienceBundle.DE_COMPONENT])
      );
    });

    it('should ensure merge set contains parents of child components instead of the children themselves', async () => {
      const mockPipeline = $$.SANDBOX.stub().resolves();
      pipelineStub.returns(mockPipeline);

      assert(DECOMPOSED_CHILD_COMPONENT_1.parent?.xml);
      await converter.convert(components, 'source', {
        type: 'merge',
        defaultDirectory,
        mergeWith: [DECOMPOSED_CHILD_COMPONENT_1, DECOMPOSED_CHILD_COMPONENT_2],
      });

      validatePipelineArgs(mockPipeline, 'source');
      expect(mockPipeline.firstCall.args[2].mergeSet).to.deep.equal(
        new ComponentSet([DECOMPOSED_CHILD_COMPONENT_1.parent])
      );
    });
  });
});
