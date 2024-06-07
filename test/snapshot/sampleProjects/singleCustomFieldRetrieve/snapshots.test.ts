/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
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
    await validateSourceDir(FORCE_APP);
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
      expect(content.split(os.EOL).length).to.equal(64);
    }
    await fileSnap(file, testOriginalDir, testDir);
  }
};
