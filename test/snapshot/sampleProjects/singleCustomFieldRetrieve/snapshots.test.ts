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
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { expect } from 'chai';
import { MetadataConverter } from '../../../../src/convert/metadataConverter';
import { ComponentSetBuilder } from '../../../../src/collections/componentSetBuilder';
import { dirEntsToPaths, fileSnap, FORCE_APP, MDAPI_OUT } from '../../helper/conversions';
import { MetadataApiRetrieve, MetadataApiRetrieveStatus } from '../../../../src';
import { ManageableState, RequestStatus } from '../../../../src/client/types';

// we don't want failing tests outputting over each other
/* eslint-disable no-await-in-loop */

const folder = 'singleCustomFieldRetrieve';
const tmpFolder = `${folder}Tmp`;
const testOriginalDir = path.join('test', 'snapshot', 'sampleProjects', folder);
const testDir = testOriginalDir.replace(folder, tmpFolder);

/**
 * retrieving a single field retrieves the object, removes the field from it, and leaves a blank object.
 * That blank object should NOT overwrite the existing object if it exists in the merge target
 */
describe('a single field in a CustomObject xml does not overwrite (blank) the existing Object', () => {
  before(async () => {
    // because we're applying changes over the existing source, move it to a new place
    await fs.promises.cp(testOriginalDir, testDir, {
      recursive: true,
      force: true,
      filter: (src) => !src.includes('__snapshots__'),
    });
  });
  it('merge a single retrieved CustomField (Email__c) into project', async () => {
    // SDR should match the original source
    const cs = await ComponentSetBuilder.build({
      sourcepath: [path.join(testDir, MDAPI_OUT)],
    });
    // a CS from the destination
    const mergeWith = (
      await ComponentSetBuilder.build({
        sourcepath: [path.join(testDir, FORCE_APP)],
      })
    ).getSourceComponents();

    const converter = new MetadataConverter();

    await converter.convert(cs, 'source', {
      type: 'merge',
      mergeWith,
      defaultDirectory: path.resolve(path.join(testDir, FORCE_APP)),
    });
  });

  it('will not overwrite .object-meta.xml', async () => {
    const cs = await ComponentSetBuilder.build({
      sourcepath: [path.join(testDir, MDAPI_OUT)],
    });
    // a CS from the destination
    const mergeWith = (
      await ComponentSetBuilder.build({
        sourcepath: [path.join(testDir, FORCE_APP)],
      })
    ).getSourceComponents();

    const converter = new MetadataConverter();

    await converter.convert(cs, 'source', {
      type: 'merge',
      mergeWith,
      defaultDirectory: path.resolve(path.join(testDir, FORCE_APP)),
    });
    await validateSourceDir(FORCE_APP);
    const pathToBroker = path.join(testDir, FORCE_APP, 'main', 'default', 'objects', 'Broker__c');

    expect(fs.readdirSync(pathToBroker).length).to.equal(2);
    expect(fs.readdirSync(path.join(pathToBroker, 'fields')).length).to.equal(2);
    const result: MetadataApiRetrieveStatus = {
      done: true,
      fileProperties: [
        {
          createdById: '005DH000009UtU7YAK',
          createdByName: 'User User',
          createdDate: '2024-06-06T15:04:19.000Z',
          fileName: 'unpackaged/objects/Broker__c.object',
          fullName: 'Broker__c',
          id: '01IDH000003YbDh2AK',
          lastModifiedById: '005DH000009UtU7YAK',
          lastModifiedByName: 'User User',
          lastModifiedDate: '2024-06-06T15:04:36.000Z',
          manageableState: ManageableState.Unmanaged,
          type: 'CustomObject',
        },
        {
          createdById: '005DH000009UtU7YAK',
          createdByName: 'User User',
          createdDate: '2024-06-06T15:04:19.000Z',
          fileName: 'unpackaged/layouts/Broker__c-Broker Layout.layout',
          fullName: 'Broker__c-Broker Layout',
          id: '00hDH000006sH7dYAE',
          lastModifiedById: '005DH000009UtU7YAK',
          lastModifiedByName: 'User User',
          lastModifiedDate: '2024-06-07T15:25:27.000Z',
          manageableState: ManageableState.Unmanaged,
          type: 'Layout',
        },
        {
          createdById: '005DH000009UtU7YAK',
          createdByName: 'User User',
          createdDate: '2024-06-07T15:25:55.880Z',
          fileName: 'unpackaged/package.xml',
          fullName: 'unpackaged/package.xml',
          id: '',
          lastModifiedById: '005DH000009UtU7YAK',
          lastModifiedByName: 'User User',
          lastModifiedDate: '2024-06-07T15:25:55.880Z',
          manageableState: ManageableState.Unmanaged,
          type: 'Package',
        },
      ],
      id: '09SDH000007quR22AI',
      status: RequestStatus.Succeeded,
      success: true,
      zipFile:
        // adds a 'testing__c' field to Broker
        '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',
      messages: [],
    };

    const retrieve = new MetadataApiRetrieve({
      output: path.join(testDir, FORCE_APP),
      merge: true,
      usernameOrConnection: 'abc',
    });
    await retrieve.post(result);
    expect(fs.readdirSync(path.join(pathToBroker, 'fields')).length).to.equal(3);
  });

  it('will not overwrite .object-meta.xml in package retrieval ', async () => {
    const TEST_PACKAGE = 'TestPackage';

    const result: MetadataApiRetrieveStatus = {
      done: true,
      fileProperties: [
        {
          createdById: '005bm000006BUfFAAW',
          createdByName: 'William Ruemmele',
          createdDate: '2024-09-30T18:10:44.000Z',
          fileName: 'TestPackage/objects/test__c.object',
          fullName: 'test__c',
          id: '01Ibm000001ZQS5EAO',
          lastModifiedById: '005bm000006BUfFAAW',
          lastModifiedByName: 'William Ruemmele',
          lastModifiedDate: '2024-09-30T18:10:44.000Z',
          manageableState: ManageableState.Unmanaged,
          type: 'CustomObject',
        },
        {
          createdById: '005bm000006BUfFAAW',
          createdByName: 'William Ruemmele',
          createdDate: '2024-09-30T18:10:44.000Z',
          fileName: 'TestPackage/layouts/test__c-test Layout.layout',
          fullName: 'test__c-test Layout',
          id: '00hbm000006bcEHAAY',
          lastModifiedById: '005bm000006BUfFAAW',
          lastModifiedByName: 'William Ruemmele',
          lastModifiedDate: '2024-09-30T18:11:30.000Z',
          manageableState: ManageableState.Unmanaged,
          type: 'Layout',
        },
        {
          createdById: '005bm000006BUfFAAW',
          createdByName: 'William Ruemmele',
          createdDate: '2024-09-30T18:12:05.000Z',
          fileName: 'TestPackage/package.xml',
          fullName: 'package',
          id: '0A2bm000000eGN7CAM',
          lastModifiedById: '005bm000006BUfFAAW',
          lastModifiedByName: 'William Ruemmele',
          lastModifiedDate: '2024-09-30T18:12:05.000Z',
          manageableState: ManageableState.Unmanaged,
          type: 'Package',
        },
        {
          createdById: '005bm000006BUfFAAW',
          createdByName: 'William Ruemmele',
          createdDate: '2024-09-30T19:59:19.089Z',
          fileName: 'unpackaged/package.xml',
          fullName: 'unpackaged/package.xml',
          id: '',
          lastModifiedById: '005bm000006BUfFAAW',
          lastModifiedByName: 'William Ruemmele',
          lastModifiedDate: '2024-09-30T19:59:19.089Z',
          manageableState: ManageableState.Unmanaged,
          type: 'Package',
        },
      ],
      id: '09Sbm000001mg2nEAA',
      status: RequestStatus.Succeeded,
      success: true,
      zipFile:
        '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',
      messages: [],
    };

    const retrieve = new MetadataApiRetrieve({
      singlePackage: true,
      packageOptions: [{ name: TEST_PACKAGE, outputDir: path.join(testDir, TEST_PACKAGE) }],
      merge: true,
      output: path.join(testDir, TEST_PACKAGE),
      usernameOrConnection: 'abc',
    });
    await retrieve.post(result);
    expect(
      fs.existsSync(
        path.join(testDir, TEST_PACKAGE, 'main', 'default', 'objects', 'test__c', 'test__c.object-meta.xml')
      )
    ).to.be.true;
    expect(
      fs.existsSync(
        path.join(testDir, TEST_PACKAGE, 'main', 'default', 'objects', 'test__c', 'fields', 'status__c.field-meta.xml')
      )
    ).to.be.true;
    expect(
      fs.existsSync(
        path.join(
          testDir,
          TEST_PACKAGE,
          'main',
          'default',
          'objects',
          'test__c',
          'fields',
          'completion__c.field-meta.xml'
        )
      )
    ).to.be.true;
  });

  it(`verify ${FORCE_APP}`, async () => {
    await validateSourceDir(FORCE_APP);
  });

  after(async () => {
    await fs.promises.rm(testDir, { recursive: true, force: true });
  });
});

const validateSourceDir = async (dir: string): Promise<void> => {
  const sourceFiles = dirEntsToPaths(
    await fs.promises.readdir(path.join(testDir, dir), {
      recursive: true,
      withFileTypes: true,
    })
  );
  for (const file of sourceFiles) {
    if (file.endsWith('.object-meta.xml')) {
      const content = fs.readFileSync(file, 'utf8');
      expect(content.split(os.EOL).length).to.be.greaterThanOrEqual(64);
    }
    await fileSnap(file, testOriginalDir, testDir);
  }
};
