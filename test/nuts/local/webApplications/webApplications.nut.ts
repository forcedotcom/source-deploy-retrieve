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

describe('webApplications local e2e', () => {
  let session: TestSession;
  let projectDir: string;

  before(async () => {
    session = await TestSession.create({
      project: {
        name: 'webApplicationsNut',
        sourceDir: path.join('test', 'nuts', 'local', 'webApplications', 'testProj'),
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
    expect(zip.file('webapplications/HappyApp/HappyApp.webapplication-meta.xml')).to.exist;
    expect(zip.file('webapplications/HappyApp/webapplication.json')).to.exist;
    expect(zip.file('webapplications/HappyApp/src/index.html')).to.exist;
  });

  it('resolves metadata-only zip for WebApplication (retrieve path skips validation)', async () => {
    const converter = new MetadataConverter();
    const cs = await ComponentSetBuilder.build({ sourcepath: [path.join(projectDir, 'force-app')] });
    const { zipBuffer } = await converter.convert(cs, 'metadata', { type: 'zip' });
    expect(zipBuffer, 'zipBuffer should be defined').to.be.instanceOf(Buffer);

    const zip = await JSZip.loadAsync(zipBuffer as Buffer);
    zip.remove('webapplications/HappyApp/webapplication.json');
    zip.remove('webapplications/HappyApp/src/index.html');

    const metadataOnlyZip = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 3 },
    });
    const tree = await ZipTreeContainer.create(metadataOnlyZip);
    const resolver = new MetadataResolver(new RegistryAccess(), tree);
    const xmlPath = 'webapplications/HappyApp/HappyApp.webapplication-meta.xml';

    // webapplication.json is optional and ZipTreeContainer skips validation,
    // so a zip with only the meta XML resolves without error.
    const components = resolver.getComponentsFromPath(xmlPath);
    expect(components).to.have.lengthOf(1);
    expect(components[0].type.name).to.equal('WebApplication');
    expect(components[0].fullName).to.equal('HappyApp');
  });
});
