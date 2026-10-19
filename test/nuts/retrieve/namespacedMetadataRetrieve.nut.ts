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
import * as path from 'node:path';
import { execCmd, TestSession } from '@salesforce/cli-plugins-testkit';
import { expect } from 'chai';
import { ComponentSetBuilder } from '../../../src';

const CONTACTS_AND_ORGS = {
  id: '04t4w0000004ALTAA2',
  namespace: 'npe01',
  accountField: 'npe01__One2OneContact__c',
};

describe('namespaced metadata retrieve NUTs', () => {
  let session: TestSession;

  before(async () => {
    session = await TestSession.create({
      project: {
        sourceDir: path.join('test', 'nuts', 'retrieve', 'namespacedMetadataRetrieveProject'),
      },
      devhubAuthStrategy: 'AUTO',
      scratchOrgs: [
        {
          setDefault: true,
          config: path.join('config', 'project-scratch-def.json'),
        },
      ],
    });

    execCmd(`package:install --package ${CONTACTS_AND_ORGS.id} --wait 5 --no-prompt --json`, {
      ensureExitCode: 0,
      silent: true,
      cli: 'sf',
    });
  });

  after(async () => {
    await session?.clean();
  });

  it('retrieves namespaced fields on standard objects', async () => {
    const componentSet = await ComponentSetBuilder.build({
      metadata: {
        metadataEntries: [`CustomField:${CONTACTS_AND_ORGS.namespace}__*`],
        directoryPaths: [path.join(session.project.dir, 'force-app')],
      },
      org: {
        username: session.orgs.get('default')?.username ?? '',
        exclude: [],
      },
    });

    const retrieve = await componentSet.retrieve({
      usernameOrConnection: session.orgs.get('default')?.username ?? '',
      output: path.join(session.project.dir, 'force-app'),
    });
    const result = await retrieve.pollStatus();

    expect(
      result
        .getFileResponses()
        .some((file) => file.type === 'CustomField' && file.fullName === `Account.${CONTACTS_AND_ORGS.accountField}`)
    ).to.equal(true);
  });
});
