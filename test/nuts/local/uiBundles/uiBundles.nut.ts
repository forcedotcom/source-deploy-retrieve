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
import JSZip from 'jszip';
import { TestSession } from '@salesforce/cli-plugins-testkit';
import { expect } from 'chai';
import {
  ComponentSetBuilder,
  MetadataConverter,
  MetadataResolver,
  RegistryAccess,
  ZipTreeContainer,
} from '../../../../src';

describe('uiBundles local e2e', () => {
  let session: TestSession;
  let projectDir: string;

  before(async () => {
    session = await TestSession.create({
      project: {
        name: 'uiBundlesNut',
        sourceDir: path.join('test', 'nuts', 'local', 'uiBundles', 'testProj'),
      },
      devhubAuthStrategy: 'NONE',
    });
    projectDir = session.project.dir;
  });

  after(async () => {
    await session?.clean();
  });

  it('converts source to metadata zip with required files', async () => {
    const converter = new MetadataConverter();
    const cs = await ComponentSetBuilder.build({ sourcepath: [path.join(projectDir, 'force-app')] });
    const { zipBuffer } = await converter.convert(cs, 'metadata', { type: 'zip' });

    expect(zipBuffer, 'zipBuffer should be defined').to.be.instanceOf(Buffer);
    const zip = await JSZip.loadAsync(zipBuffer as Buffer);
    expect(zip.file('uiBundles/HappyApp/HappyApp.uibundle-meta.xml')).to.exist;
    expect(zip.file('uiBundles/HappyApp/ui-bundle.json')).to.exist;
    expect(zip.file('uiBundles/HappyApp/src/index.html')).to.exist;
  });

  it('converts UIBundle with multiple content files to metadata zip', async () => {
    const converter = new MetadataConverter();
    const cs = await ComponentSetBuilder.build({ sourcepath: [path.join(projectDir, 'force-app')] });
    const { zipBuffer } = await converter.convert(cs, 'metadata', { type: 'zip' });

    expect(zipBuffer, 'zipBuffer should be defined').to.be.instanceOf(Buffer);
    const zip = await JSZip.loadAsync(zipBuffer as Buffer);
    const contentPaths = [
      'uiBundles/HappyApp/src/index.html',
      'uiBundles/HappyApp/src/app.js',
      'uiBundles/HappyApp/src/styles.css',
    ];
    for (const p of contentPaths) {
      expect(zip.file(p), `zip should include ${p}`).to.exist;
    }
  });

  it('resolves UIBundle with multiple content files from source', async () => {
    const cs = await ComponentSetBuilder.build({ sourcepath: [path.join(projectDir, 'force-app')] });
    const components = cs.getSourceComponents().toArray();
    expect(components).to.have.lengthOf(1);
    expect(components[0].type.name).to.equal('UIBundle');
    expect(components[0].fullName).to.equal('HappyApp');
    const contentFiles = components[0].walkContent().map((p) => path.basename(p));
    expect(contentFiles).to.include('index.html');
    expect(contentFiles).to.include('app.js');
    expect(contentFiles).to.include('styles.css');
    expect(contentFiles).to.include('ui-bundle.json');
  });

  it('throws when ui-bundle.json is invalid (NodeFSTreeContainer validation)', async () => {
    const descriptorPath = path.join(
      projectDir,
      'force-app',
      'main',
      'default',
      'uiBundles',
      'HappyApp',
      'ui-bundle.json'
    );
    const original = fs.readFileSync(descriptorPath, 'utf8');
    try {
      fs.writeFileSync(descriptorPath, '{"unclosed');
      let threw = false;
      try {
        await ComponentSetBuilder.build({ sourcepath: [path.join(projectDir, 'force-app')] });
      } catch (err) {
        threw = true;
        expect((err as Error).message).to.match(/ui-bundle\.json/);
      }
      expect(threw, 'expected ComponentSetBuilder.build to throw').to.be.true;
    } finally {
      fs.writeFileSync(descriptorPath, original);
    }
  });

  it('resolves metadata-only zip for UIBundle (retrieve path skips validation)', async () => {
    const converter = new MetadataConverter();
    const cs = await ComponentSetBuilder.build({ sourcepath: [path.join(projectDir, 'force-app')] });
    const { zipBuffer } = await converter.convert(cs, 'metadata', { type: 'zip' });
    expect(zipBuffer, 'zipBuffer should be defined').to.be.instanceOf(Buffer);

    const zip = await JSZip.loadAsync(zipBuffer as Buffer);
    zip.remove('uiBundles/HappyApp/ui-bundle.json');
    zip.remove('uiBundles/HappyApp/src/index.html');

    const metadataOnlyZip = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 3 },
    });
    const tree = await ZipTreeContainer.create(metadataOnlyZip);
    const resolver = new MetadataResolver(new RegistryAccess(), tree);
    const xmlPath = path.join('uiBundles', 'HappyApp', 'HappyApp.uibundle-meta.xml');

    // ui-bundle.json is optional and ZipTreeContainer skips validation,
    // so a zip with only the meta XML resolves without error.
    const components = resolver.getComponentsFromPath(xmlPath);
    expect(components).to.have.lengthOf(1);
    expect(components[0].type.name).to.equal('UIBundle');
    expect(components[0].fullName).to.equal('HappyApp');
  });
});
