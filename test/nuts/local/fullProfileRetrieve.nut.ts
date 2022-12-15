/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { join } from 'path';
import * as fs from 'fs';
import { TestSession } from '@salesforce/cli-plugins-testkit';
import { expect } from 'chai';
import { Duration } from '@salesforce/kit';
import { ComponentSetBuilder } from '../../../src';

describe('full Profile retrieves', () => {
  let session: TestSession;
  let adminProfileContent: string;
  let username: string;
  let profileDir: string;
  let output: string;
  const adminProfileName = 'Admin.profile-meta.xml';

  const readAdminProfile = (): string => fs.readFileSync(join(profileDir, adminProfileName), 'utf-8');

  before(async () => {
    session = await TestSession.create({
      project: {
        gitClone: 'https://github.com/WillieRuemmele/ebikes-lwc',
      },
      devhubAuthStrategy: 'AUTO',
      scratchOrgs: [
        {
          executable: 'sfdx',
          config: join('config', 'project-scratch-def.json'),
          setDefault: true,
          wait: 10,
          duration: 1,
        },
      ],
    });

    username = session.orgs.get('default').username;

    profileDir = join(session.project.dir, 'force-app', 'main', 'default', 'profiles');
    output = join(session.project.dir, 'force-app');
    // retrieved via force:source:retrieve -m Profile with standardProfileRetrieve = false
    adminProfileContent = fs.readFileSync(join(profileDir, adminProfileName), 'utf-8');
  });

  after(async () => {
    await session.clean();
  });

  it('will retrieve the Admin Profile using the tooling api (SOURCE format)', async () => {
    const compSet = await ComponentSetBuilder.build({ sourcepath: [join(profileDir, adminProfileName)] });
    const retrieve = await compSet.retrieve({ output, usernameOrConnection: username, format: 'source' });
    await retrieve.pollStatus({ timeout: Duration.minutes(10) });
    const updatedAdminProfile = readAdminProfile();
    expect(updatedAdminProfile).to.include('<categoryGroupVisibilities/>');
    expect(updatedAdminProfile).to.include('<description/>');
    expect(updatedAdminProfile).to.include('<loginFlows/>');
    expect(updatedAdminProfile).to.include('<loginHours/>');
    expect(updatedAdminProfile).to.include('<profileActionOverrides/>');
    expect(updatedAdminProfile).to.include('<urls/>');
    expect(adminProfileContent).to.not.equal(updatedAdminProfile);
  });

  it('will retrieve the Admin Profile using the tooling api and other MD using MDAPI', async () => {
    const apexClassPath = join(session.project.dir, 'force-app', 'main', 'default', 'classes', 'PagedResult.cls');
    const apexContentBefore = fs.readFileSync(apexClassPath, 'utf-8');

    const compSet = await ComponentSetBuilder.build({
      sourcepath: [join(profileDir, adminProfileName), apexClassPath],
    });
    const retrieve = await compSet.retrieve({ output, usernameOrConnection: username, format: 'source' });
    await retrieve.pollStatus({ timeout: Duration.minutes(10) });

    const updatedAdminProfile = readAdminProfile();
    const updatedApexClass = fs.readFileSync(apexClassPath, 'utf-8');
    expect(updatedAdminProfile).to.include('<categoryGroupVisibilities/>');
    expect(updatedAdminProfile).to.include('<description/>');
    expect(updatedAdminProfile).to.include('<loginFlows/>');
    expect(updatedAdminProfile).to.include('<loginHours/>');
    expect(updatedAdminProfile).to.include('<profileActionOverrides/>');
    expect(updatedAdminProfile).to.include('<urls/>');
    expect(adminProfileContent).to.not.equal(updatedAdminProfile);
    expect(apexContentBefore).to.equal(updatedApexClass);
  });

  it('will retrieve the Admin Profile using the tooling api (METADATA format)', async () => {
    const compSet = await ComponentSetBuilder.build({ sourcepath: [join(profileDir, adminProfileName)] });
    const retrieve = await compSet.retrieve({
      output,
      usernameOrConnection: username,
      format: 'metadata',
    });
    await retrieve.pollStatus({ timeout: Duration.minutes(10) });
    const updatedAdminProfile = readAdminProfile();
    expect(updatedAdminProfile).to.include('<categoryGroupVisibilities/>');
    expect(updatedAdminProfile).to.include('<description/>');
    expect(updatedAdminProfile).to.include('<loginFlows/>');
    expect(updatedAdminProfile).to.include('<loginHours/>');
    expect(updatedAdminProfile).to.include('<profileActionOverrides/>');
    expect(updatedAdminProfile).to.include('<urls/>');
    expect(adminProfileContent).to.not.equal(updatedAdminProfile);
  });
});
