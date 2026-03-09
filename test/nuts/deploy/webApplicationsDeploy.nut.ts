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
import * as fs from 'node:fs';
import * as path from 'node:path';
import { TestSession, execCmd } from '@salesforce/cli-plugins-testkit';
import { expect } from 'chai';

type DeployFile = {
  state: string;
  fullName: string;
  type: string;
  filePath: string;
};
type DeployResultJson = {
  done: boolean;
  success: boolean;
  files: DeployFile[];
};

describe('WebApplication deploy NUTs (real org)', () => {
  let session: TestSession;
  let projectDir: string;
  let targetOrg: string;

  before(async () => {
    session = await TestSession.create({
      project: {
        name: 'webAppDeployNut',
        sourceDir: path.join('test', 'nuts', 'local', 'webApplications', 'testProj'),
      },
      devhubAuthStrategy: 'AUTH_URL',
    });
    projectDir = session.project.dir;
    targetOrg = session.hubOrg.username!;
  });

  after(async () => {
    await session?.clean();
  });

  it('initial deploy returns per-file Created status', () => {
    const appName = `NutDeploy${Date.now()}`;
    const appDir = path.join(projectDir, 'force-app', 'main', 'default', 'webapplications', appName);
    const distDir = path.join(appDir, 'dist');
    fs.mkdirSync(distDir, { recursive: true });

    fs.writeFileSync(
      path.join(appDir, `${appName}.webapplication-meta.xml`),
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<WebApplication xmlns="http://soap.sforce.com/2006/04/metadata">',
        `  <masterLabel>${appName}</masterLabel>`,
        '  <isActive>true</isActive>',
        '  <version>1</version>',
        '</WebApplication>',
      ].join('\n')
    );
    fs.writeFileSync(path.join(appDir, 'webapplication.json'), JSON.stringify({ outputDir: 'dist' }));
    fs.writeFileSync(path.join(distDir, 'index.html'), '<html><body>Hello</body></html>');
    fs.writeFileSync(path.join(distDir, 'app.js'), 'console.log("init");');

    const result = execCmd<DeployResultJson>(
      `project deploy start --source-dir ${appDir} --target-org ${targetOrg} --json`,
      { ensureExitCode: 0, cli: 'sf' }
    );

    expect(result.jsonOutput?.status).to.equal(0);
    const files = result.jsonOutput!.result.files;
    expect(files.length).to.be.greaterThanOrEqual(3);

    const indexFile = files.find((f) => f.filePath.includes('index.html'));
    expect(indexFile, 'index.html should be in deploy results').to.exist;
    expect(indexFile!.state).to.equal('Created');

    const appJsFile = files.find((f) => f.filePath.includes('app.js'));
    expect(appJsFile, 'app.js should be in deploy results').to.exist;
    expect(appJsFile!.state).to.equal('Created');

    const metaFile = files.find((f) => f.filePath.endsWith('.webapplication-meta.xml'));
    expect(metaFile, 'meta xml should be in deploy results').to.exist;

    const internalFiles = files.filter(
      (f) => f.filePath.includes('webapplicationcontentindex') || f.filePath.includes('languageSettings')
    );
    expect(internalFiles, 'server-internal paths should be filtered out').to.have.lengthOf(0);
  });

  it('re-deploy with modified + new files returns Changed and Created', () => {
    const appName = `NutRedeploy${Date.now()}`;
    const appDir = path.join(projectDir, 'force-app', 'main', 'default', 'webapplications', appName);
    const distDir = path.join(appDir, 'dist');
    fs.mkdirSync(distDir, { recursive: true });

    fs.writeFileSync(
      path.join(appDir, `${appName}.webapplication-meta.xml`),
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<WebApplication xmlns="http://soap.sforce.com/2006/04/metadata">',
        `  <masterLabel>${appName}</masterLabel>`,
        '  <isActive>true</isActive>',
        '  <version>1</version>',
        '</WebApplication>',
      ].join('\n')
    );
    fs.writeFileSync(path.join(appDir, 'webapplication.json'), JSON.stringify({ outputDir: 'dist' }));
    fs.writeFileSync(path.join(distDir, 'index.html'), '<html><body>v1</body></html>');

    // First deploy
    execCmd(`project deploy start --source-dir ${appDir} --target-org ${targetOrg} --json`, {
      ensureExitCode: 0,
      cli: 'sf',
    });

    // Modify existing file and add a new one
    fs.writeFileSync(path.join(distDir, 'index.html'), '<html><body>v2 updated</body></html>');
    fs.writeFileSync(path.join(distDir, 'newfile.js'), 'console.log("new");');

    // Second deploy
    const result = execCmd<DeployResultJson>(
      `project deploy start --source-dir ${appDir} --target-org ${targetOrg} --json`,
      { ensureExitCode: 0, cli: 'sf' }
    );

    const files = result.jsonOutput!.result.files;
    const states = new Set(files.map((f) => f.state));
    expect(states.has('Changed') || states.has('Created'), 'should have Changed or Created states').to.be.true;

    const newFile = files.find((f) => f.filePath.includes('newfile.js'));
    expect(newFile, 'newfile.js should be in deploy results').to.exist;
    expect(newFile!.state).to.equal('Created');
  });
});
