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
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect } from 'chai';
import { ForceIgnore, NodeFSTreeContainer, RegistryAccess, SourceComponent, registry } from '../../../src';
import { UiBundleMetadataTransformer } from '../../../src/convert/transformers/uiBundleMetadataTransformer';

const registryAccess = new RegistryAccess();

describe('UiBundleMetadataTransformer', () => {
  let tmpDir: string;
  let appDir: string;

  const buildComponent = (): SourceComponent => {
    const xml = join(appDir, 'TestApp.uibundle-meta.xml');
    return new SourceComponent(
      { name: 'TestApp', type: registry.types.uibundle, content: appDir, xml },
      new NodeFSTreeContainer(),
      new ForceIgnore()
    );
  };

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'uibundle-transformer-'));
    appDir = join(tmpDir, registry.types.uibundle.directoryName, 'TestApp');
    mkdirSync(appDir, { recursive: true });
    writeFileSync(join(appDir, 'TestApp.uibundle-meta.xml'), '<UIBundle/>');
    mkdirSync(join(appDir, 'dist'), { recursive: true });
    writeFileSync(join(appDir, 'dist', 'index.html'), '<html/>');
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('toMetadataFormat (deploy) validates the descriptor', () => {
    it('succeeds for a valid built bundle', async () => {
      writeFileSync(join(appDir, 'ui-bundle.json'), JSON.stringify({ outputDir: 'dist' }));
      const transformer = new UiBundleMetadataTransformer(registryAccess);
      const infos = await transformer.toMetadataFormat(buildComponent());
      expect(infos.length).to.be.greaterThan(0);
    });

    it('throws ExpectedSourceFilesError when outputDir is missing', async () => {
      rmSync(join(appDir, 'dist'), { recursive: true, force: true });
      writeFileSync(join(appDir, 'ui-bundle.json'), JSON.stringify({ outputDir: 'dist' }));
      const transformer = new UiBundleMetadataTransformer(registryAccess);
      try {
        await transformer.toMetadataFormat(buildComponent());
        expect.fail('expected toMetadataFormat to throw');
      } catch (err) {
        expect((err as Error).name).to.equal('ExpectedSourceFilesError');
      }
    });

    it('throws for an invalid descriptor', async () => {
      writeFileSync(join(appDir, 'ui-bundle.json'), '{"unclosed');
      const transformer = new UiBundleMetadataTransformer(registryAccess);
      try {
        await transformer.toMetadataFormat(buildComponent());
        expect.fail('expected toMetadataFormat to throw');
      } catch (err) {
        expect((err as Error).message).to.match(/ui-bundle\.json/);
      }
    });

    it('succeeds when ui-bundle.json is absent', async () => {
      const transformer = new UiBundleMetadataTransformer(registryAccess);
      const infos = await transformer.toMetadataFormat(buildComponent());
      expect(infos.length).to.be.greaterThan(0);
    });
  });

  describe('toSourceFormat (retrieve) skips validation', () => {
    it('does not throw for an invalid descriptor', async () => {
      writeFileSync(join(appDir, 'ui-bundle.json'), '{"unclosed');
      const transformer = new UiBundleMetadataTransformer(registryAccess);
      const infos = await transformer.toSourceFormat({ component: buildComponent() });
      expect(infos.length).to.be.greaterThan(0);
    });
  });
});
