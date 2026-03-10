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
import { execSync } from 'node:child_process';
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

/**
 * Submit a deploy via --async, then poll with deploy report until complete.
 * Works around CLI progress-stage message compatibility issues when the local
 * SDR is newer than the installed CLI (metadata.transfer:Finalizing).
 */
function deployAndWait(sourceDir: string, targetOrg: string): DeployFile[] {
  const asyncResult = execCmd<{ id: string }>(
    `project deploy start --source-dir ${sourceDir} --target-org ${targetOrg} --async --json`,
    { ensureExitCode: 0, cli: 'sf' }
  );
  const deployId = asyncResult.jsonOutput!.result.id;

  for (let attempt = 0; attempt < 40; attempt++) {
    execSync('sleep 3');
    const report = execCmd<DeployResultJson>(
      `project deploy report --job-id ${deployId} --target-org ${targetOrg} --json`,
      { cli: 'sf' }
    );
    if (report.jsonOutput?.result?.done) {
      expect(report.jsonOutput.result.success, 'deploy should succeed').to.be.true;
      return report.jsonOutput.result.files ?? [];
    }
  }
  throw new Error(`Deploy ${deployId} did not complete within timeout`);
}

function writeMetaXml(appDir: string, appName: string): void {
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
}

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

    writeMetaXml(appDir, appName);
    fs.writeFileSync(path.join(appDir, 'webapplication.json'), JSON.stringify({ outputDir: 'dist' }));
    fs.writeFileSync(path.join(distDir, 'index.html'), '<html><body>Hello</body></html>');
    fs.writeFileSync(path.join(distDir, 'app.js'), 'console.log("init");');

    const files = deployAndWait(appDir, targetOrg);
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

    writeMetaXml(appDir, appName);
    fs.writeFileSync(path.join(appDir, 'webapplication.json'), JSON.stringify({ outputDir: 'dist' }));
    fs.writeFileSync(path.join(distDir, 'index.html'), '<html><body>v1</body></html>');

    deployAndWait(appDir, targetOrg);

    fs.writeFileSync(path.join(distDir, 'index.html'), '<html><body>v2 updated</body></html>');
    fs.writeFileSync(path.join(distDir, 'newfile.js'), 'console.log("new");');

    const files = deployAndWait(appDir, targetOrg);
    const states = new Set(files.map((f) => f.state));
    expect(states.has('Changed') || states.has('Created'), 'should have Changed or Created states').to.be.true;

    const newFile = files.find((f) => f.filePath.includes('newfile.js'));
    expect(newFile, 'newfile.js should be in deploy results').to.exist;
    expect(newFile!.state).to.equal('Created');
  });

  it('deleted file reports Deleted status, not Changed', () => {
    const appName = `NutDelete${Date.now()}`;
    const appDir = path.join(projectDir, 'force-app', 'main', 'default', 'webapplications', appName);
    const distDir = path.join(appDir, 'dist');
    fs.mkdirSync(distDir, { recursive: true });

    writeMetaXml(appDir, appName);
    fs.writeFileSync(path.join(appDir, 'webapplication.json'), JSON.stringify({ outputDir: 'dist' }));
    fs.writeFileSync(path.join(distDir, 'index.html'), '<html><body>keep</body></html>');
    fs.writeFileSync(path.join(distDir, 'remove-me.js'), 'console.log("will be deleted");');

    deployAndWait(appDir, targetOrg);

    fs.unlinkSync(path.join(distDir, 'remove-me.js'));

    const files = deployAndWait(appDir, targetOrg);

    const removedFile = files.find((f) => f.filePath.includes('remove-me.js'));
    expect(removedFile, 'remove-me.js should appear in deploy results').to.exist;
    expect(removedFile!.state).to.equal('Deleted');

    const keptFile = files.find((f) => f.filePath.includes('index.html'));
    expect(keptFile, 'index.html should still be in results').to.exist;
    expect(keptFile!.state).to.equal('Unchanged');
  });

  it('unchanged re-deploy reports all files as Unchanged', () => {
    const appName = `NutUnchanged${Date.now()}`;
    const appDir = path.join(projectDir, 'force-app', 'main', 'default', 'webapplications', appName);
    const distDir = path.join(appDir, 'dist');
    fs.mkdirSync(distDir, { recursive: true });

    writeMetaXml(appDir, appName);
    fs.writeFileSync(path.join(appDir, 'webapplication.json'), JSON.stringify({ outputDir: 'dist' }));
    fs.writeFileSync(path.join(distDir, 'index.html'), '<html><body>static</body></html>');
    fs.writeFileSync(path.join(distDir, 'app.js'), 'console.log("static");');

    deployAndWait(appDir, targetOrg);

    const files = deployAndWait(appDir, targetOrg);
    expect(files.length, 'deploy should return file results').to.be.greaterThan(0);

    const contentFiles = files.filter(
      (f) => !f.filePath.endsWith('.webapplication-meta.xml') && !f.filePath.endsWith('webapplication.json')
    );
    for (const f of contentFiles) {
      expect(f.state, `${f.filePath} should be Unchanged`).to.equal('Unchanged');
    }
  });

  it('retrieve round-trip returns per-file results and matches deployed content', () => {
    const appName = `NutRetrieve${Date.now()}`;
    const appDir = path.join(projectDir, 'force-app', 'main', 'default', 'webapplications', appName);
    const distDir = path.join(appDir, 'dist');
    fs.mkdirSync(distDir, { recursive: true });

    const htmlContent = '<html><body>retrieve test</body></html>';
    const jsContent = 'console.log("retrieve");';

    writeMetaXml(appDir, appName);
    fs.writeFileSync(path.join(appDir, 'webapplication.json'), JSON.stringify({ outputDir: 'dist' }));
    fs.writeFileSync(path.join(distDir, 'index.html'), htmlContent);
    fs.writeFileSync(path.join(distDir, 'app.js'), jsContent);

    deployAndWait(appDir, targetOrg);

    // Overwrite local files with different content, then retrieve
    fs.writeFileSync(path.join(distDir, 'index.html'), 'LOCAL STALE CONTENT');
    fs.writeFileSync(path.join(distDir, 'app.js'), 'LOCAL STALE CONTENT');

    const result = execCmd<{ files: DeployFile[] }>(
      `project retrieve start --metadata WebApplication:${appName} --target-org ${targetOrg} --json`,
      { ensureExitCode: 0, cli: 'sf' }
    );

    const files = result.jsonOutput!.result.files;
    expect(files.length).to.be.greaterThanOrEqual(2);

    const indexFile = files.find((f) => f.filePath.includes('index.html'));
    expect(indexFile, 'index.html should be in retrieve results').to.exist;

    const appJsFile = files.find((f) => f.filePath.includes('app.js'));
    expect(appJsFile, 'app.js should be in retrieve results').to.exist;

    const retrievedHtml = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8');
    expect(retrievedHtml).to.include('retrieve test');
    expect(retrievedHtml).to.not.include('LOCAL STALE CONTENT');

    const retrievedJs = fs.readFileSync(path.join(distDir, 'app.js'), 'utf8');
    expect(retrievedJs).to.include('retrieve');

    const internalFiles = files.filter(
      (f) => f.filePath.includes('webapplicationcontentindex') || f.filePath.includes('languageSettings')
    );
    expect(internalFiles, 'no internal paths in retrieve results').to.have.lengthOf(0);
  });
});
