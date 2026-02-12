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
import { join } from 'node:path';
import { assert, expect } from 'chai';
import { Messages, SfError } from '@salesforce/core';
import {
  ForceIgnore,
  RegistryAccess,
  SourceComponent,
  VirtualTreeContainer,
  VirtualDirectory,
  registry,
} from '../../../src';
import { WebApplicationsSourceAdapter } from '../../../src/resolve/adapters';
import { RegistryTestUtil } from '../registryTestUtil';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/source-deploy-retrieve', 'sdr');

describe('WebApplicationsSourceAdapter', () => {
  const BASE_PATH = join('path', 'to', registry.types.webapplication.directoryName);
  const APP_NAME = 'Zenith';
  const APP_PATH = join(BASE_PATH, APP_NAME);
  const META_FILE = join(APP_PATH, `${APP_NAME}.webapplication-meta.xml`);
  const JSON_FILE = join(APP_PATH, 'webapplication.json');
  const CONTENT_FILE = join(APP_PATH, 'src', 'index.html');
  const DIST_PATH = join(APP_PATH, 'dist');

  const VALID_CONFIG = {
    outputDir: 'dist',
    routing: { trailingSlash: 'never', fallback: '/index.html' },
  };

  const registryAccess = new RegistryAccess();
  const forceIgnore = new ForceIgnore();
  const tree = new VirtualTreeContainer([
    {
      dirPath: APP_PATH,
      children: [
        `${APP_NAME}.webapplication-meta.xml`,
        { name: 'webapplication.json', data: Buffer.from(JSON.stringify(VALID_CONFIG)) },
        'src',
      ],
    },
    { dirPath: join(APP_PATH, 'src'), children: ['index.html'] },
    { dirPath: DIST_PATH, children: [{ name: 'index.html', data: Buffer.from('<html>test</html>') }] },
  ]);
  const adapter = new WebApplicationsSourceAdapter(registry.types.webapplication, registryAccess, forceIgnore, tree);

  const expectedComponent = new SourceComponent(
    { name: APP_NAME, type: registry.types.webapplication, content: APP_PATH, xml: META_FILE },
    tree,
    forceIgnore
  );

  it('should return a SourceComponent for the metadata xml', () => {
    expect(adapter.getComponent(META_FILE)).to.deep.equal(expectedComponent);
  });

  it('should return a SourceComponent for the descriptor json', () => {
    expect(adapter.getComponent(JSON_FILE)).to.deep.equal(expectedComponent);
  });

  it('should return a SourceComponent for any content file in the app', () => {
    expect(adapter.getComponent(CONTENT_FILE)).to.deep.equal(expectedComponent);
  });

  it('should return a SourceComponent for the app directory', () => {
    expect(adapter.getComponent(APP_PATH)).to.deep.equal(expectedComponent);
  });

  it('should throw ExpectedSourceFilesError when metadata xml is missing', () => {
    const noXmlTree = VirtualTreeContainer.fromFilePaths([JSON_FILE, CONTENT_FILE]);
    const noXmlAdapter = new WebApplicationsSourceAdapter(
      registry.types.webapplication,
      registryAccess,
      forceIgnore,
      noXmlTree
    );
    assert.throws(
      () => noXmlAdapter.getComponent(APP_PATH),
      SfError,
      messages.getMessage('error_expected_source_files', [META_FILE, registry.types.webapplication.name])
    );
  });

  it('should skip source validation when resolving metadata only', () => {
    const metadataTree = VirtualTreeContainer.fromFilePaths([META_FILE]);
    const metadataAdapter = new WebApplicationsSourceAdapter(
      registry.types.webapplication,
      registryAccess,
      forceIgnore,
      metadataTree
    );
    const expected = new SourceComponent(
      { name: APP_NAME, type: registry.types.webapplication, content: APP_PATH, xml: META_FILE },
      metadataTree,
      forceIgnore
    );
    expect(metadataAdapter.getComponent(META_FILE, false)).to.deep.equal(expected);
  });

  describe('without webapplication.json (dist fallback)', () => {
    it('should throw when the dist folder does not exist', () => {
      const t = VirtualTreeContainer.fromFilePaths([META_FILE, CONTENT_FILE]);
      const a = new WebApplicationsSourceAdapter(registry.types.webapplication, registryAccess, forceIgnore, t);
      assert.throws(
        () => a.getComponent(APP_PATH),
        SfError,
        "When webapplication.json is not present, a 'dist' folder containing 'index.html' is required. The 'dist' folder was not found."
      );
    });

    it('should throw when dist exists but index.html is missing', () => {
      const vfs: VirtualDirectory[] = [
        { dirPath: APP_PATH, children: [`${APP_NAME}.webapplication-meta.xml`, 'dist'] },
        { dirPath: DIST_PATH, children: [] },
      ];
      const t = new VirtualTreeContainer(vfs);
      const a = new WebApplicationsSourceAdapter(registry.types.webapplication, registryAccess, forceIgnore, t);
      assert.throws(
        () => a.getComponent(APP_PATH),
        SfError,
        "When webapplication.json is not present, a 'dist/index.html' file is required as the entry point. The file was not found."
      );
    });

    it('should throw when dist/index.html is empty', () => {
      const vfs: VirtualDirectory[] = [
        { dirPath: APP_PATH, children: [`${APP_NAME}.webapplication-meta.xml`] },
        { dirPath: DIST_PATH, children: [{ name: 'index.html', data: Buffer.from('') }] },
      ];
      const t = new VirtualTreeContainer(vfs);
      const a = new WebApplicationsSourceAdapter(registry.types.webapplication, registryAccess, forceIgnore, t);
      assert.throws(
        () => a.getComponent(APP_PATH),
        SfError,
        "When webapplication.json is not present, 'dist/index.html' must exist and be non-empty. The file was found but is empty."
      );
    });

    it('should succeed when dist/index.html exists and is non-empty', () => {
      const vfs: VirtualDirectory[] = [
        { dirPath: APP_PATH, children: [`${APP_NAME}.webapplication-meta.xml`] },
        { dirPath: DIST_PATH, children: [{ name: 'index.html', data: Buffer.from('<html><body>App</body></html>') }] },
      ];
      const t = new VirtualTreeContainer(vfs);
      const a = new WebApplicationsSourceAdapter(registry.types.webapplication, registryAccess, forceIgnore, t);
      const expected = new SourceComponent(
        { name: APP_NAME, type: registry.types.webapplication, content: APP_PATH, xml: META_FILE },
        t,
        forceIgnore
      );
      expect(a.getComponent(APP_PATH)).to.deep.equal(expected);
    });

    it('should fall back to dist/index.html when webapplication.json is force-ignored', () => {
      const testUtil = new RegistryTestUtil();
      const fi = testUtil.stubForceIgnore({ seed: APP_PATH, deny: [JSON_FILE] });
      const vfs: VirtualDirectory[] = [
        {
          dirPath: APP_PATH,
          children: [
            `${APP_NAME}.webapplication-meta.xml`,
            { name: 'webapplication.json', data: Buffer.from(JSON.stringify(VALID_CONFIG)) },
          ],
        },
        { dirPath: DIST_PATH, children: [{ name: 'index.html', data: Buffer.from('<html>test</html>') }] },
      ];
      const t = new VirtualTreeContainer(vfs);
      const a = new WebApplicationsSourceAdapter(registry.types.webapplication, registryAccess, fi, t);
      const expected = new SourceComponent(
        { name: APP_NAME, type: registry.types.webapplication, content: APP_PATH, xml: META_FILE },
        t,
        fi
      );
      expect(a.getComponent(APP_PATH)).to.deep.equal(expected);
      testUtil.restore();
    });
  });

  describe('webapplication.json validation', () => {
    // helper: build an adapter whose tree has the given webapplication.json content
    // plus optional extra VirtualDirectory entries for dist, etc.
    const adapterWith = (config: object, extraDirs: VirtualDirectory[] = []): WebApplicationsSourceAdapter => {
      const vfs: VirtualDirectory[] = [
        {
          dirPath: APP_PATH,
          children: [
            `${APP_NAME}.webapplication-meta.xml`,
            { name: 'webapplication.json', data: Buffer.from(JSON.stringify(config)) },
          ],
        },
        ...extraDirs,
      ];
      return new WebApplicationsSourceAdapter(
        registry.types.webapplication,
        registryAccess,
        forceIgnore,
        new VirtualTreeContainer(vfs)
      );
    };

    it('should throw on malformed JSON with full error detail', () => {
      const vfs: VirtualDirectory[] = [
        {
          dirPath: APP_PATH,
          children: [
            `${APP_NAME}.webapplication-meta.xml`,
            { name: 'webapplication.json', data: Buffer.from('{ not valid json }') },
          ],
        },
      ];
      const a = new WebApplicationsSourceAdapter(
        registry.types.webapplication,
        registryAccess,
        forceIgnore,
        new VirtualTreeContainer(vfs)
      );
      assert.throws(
        () => a.getComponent(APP_PATH),
        SfError,
        /^Invalid JSON in webapplication\.json: .+/
      );
    });

    it('should throw when outputDir is missing', () => {
      const a = adapterWith({ routing: { fallback: '/index.html' } });
      assert.throws(
        () => a.getComponent(APP_PATH),
        SfError,
        "webapplication.json is missing required field 'outputDir'"
      );
    });

    it('should throw when outputDir directory does not exist on disk', () => {
      const a = adapterWith({ outputDir: 'build', routing: { trailingSlash: 'auto', fallback: '/index.html' } });
      assert.throws(
        () => a.getComponent(APP_PATH),
        SfError,
        messages.getMessage('error_expected_source_files', [
          join(APP_PATH, 'build'),
          registry.types.webapplication.name,
        ])
      );
    });

    it('should throw when routing is missing', () => {
      const a = adapterWith({ outputDir: 'dist' }, [
        { dirPath: DIST_PATH, children: [{ name: 'index.html', data: Buffer.from('<html>test</html>') }] },
      ]);
      assert.throws(() => a.getComponent(APP_PATH), SfError, "webapplication.json is missing required field 'routing'");
    });

    it('should throw when routing.fallback is missing', () => {
      const a = adapterWith({ outputDir: 'dist', routing: { trailingSlash: 'never' } }, [
        { dirPath: DIST_PATH, children: [{ name: 'index.html', data: Buffer.from('<html>test</html>') }] },
      ]);
      assert.throws(
        () => a.getComponent(APP_PATH),
        SfError,
        "webapplication.json is missing required field 'routing.fallback'"
      );
    });

    it('should throw when routing.trailingSlash is missing', () => {
      const a = adapterWith({ outputDir: 'dist', routing: { fallback: '/index.html' } }, [
        { dirPath: DIST_PATH, children: [{ name: 'index.html', data: Buffer.from('<html>test</html>') }] },
      ]);
      assert.throws(
        () => a.getComponent(APP_PATH),
        SfError,
        "webapplication.json is missing required field 'routing.trailingSlash'"
      );
    });

    it('should throw when the fallback file does not exist on disk', () => {
      const a = adapterWith({ outputDir: 'dist', routing: { trailingSlash: 'never', fallback: '/missing.html' } }, [
        { dirPath: DIST_PATH, children: [] },
      ]);
      assert.throws(
        () => a.getComponent(APP_PATH),
        SfError,
        "The filepath defined in the webapplication.json -> routing.fallback was not found. Ensure this file exists at the location defined."
      );
    });

    it('should throw when a rewrite target does not exist on disk', () => {
      const config = {
        outputDir: 'dist',
        routing: {
          trailingSlash: 'never',
          fallback: '/index.html',
          rewrites: [{ route: '/test', rewrite: '/missing-rewrite.html' }],
        },
      };
      const a = adapterWith(config, [
        { dirPath: DIST_PATH, children: [{ name: 'index.html', data: Buffer.from('<html>test</html>') }] },
      ]);
      const expectedPath = join(DIST_PATH, 'missing-rewrite.html');
      assert.throws(
        () => a.getComponent(APP_PATH),
        SfError,
        `A rewrite target defined in webapplication.json -> routing.rewrites was not found: ${expectedPath}. Ensure the file exists at that location.`
      );
    });

    it('should accept a valid descriptor with outputDir, routing, and rewrites', () => {
      const config = {
        outputDir: 'dist',
        routing: {
          trailingSlash: 'never',
          fallback: '/index.html',
          rewrites: [{ route: '/api/*', rewrite: '/api-proxy.html' }],
        },
      };
      const distDir: VirtualDirectory = {
        dirPath: DIST_PATH,
        children: [
          { name: 'index.html', data: Buffer.from('<html>test</html>') },
          { name: 'api-proxy.html', data: Buffer.from('<html>api</html>') },
        ],
      };
      const a = adapterWith(config, [distDir]);
      const t = new VirtualTreeContainer([
        {
          dirPath: APP_PATH,
          children: [
            `${APP_NAME}.webapplication-meta.xml`,
            { name: 'webapplication.json', data: Buffer.from(JSON.stringify(config)) },
          ],
        },
        distDir,
      ]);
      const expected = new SourceComponent(
        { name: APP_NAME, type: registry.types.webapplication, content: APP_PATH, xml: META_FILE },
        t,
        forceIgnore
      );
      expect(a.getComponent(APP_PATH)).to.deep.equal(expected);
    });

    it('should validate all rewrites when multiple are present', () => {
      const config = {
        outputDir: 'dist',
        routing: {
          trailingSlash: 'auto',
          fallback: '/index.html',
          rewrites: [
            { route: '/api/*', rewrite: '/api.html' },
            { route: '/docs/*', rewrite: '/docs.html' },
            { route: '/admin', rewrite: '/admin.html' },
          ],
        },
      };
      const distDir: VirtualDirectory = {
        dirPath: DIST_PATH,
        children: [
          { name: 'index.html', data: Buffer.from('<html>test</html>') },
          { name: 'api.html', data: Buffer.from('<html>api</html>') },
          { name: 'docs.html', data: Buffer.from('<html>docs</html>') },
          { name: 'admin.html', data: Buffer.from('<html>admin</html>') },
        ],
      };
      const a = adapterWith(config, [distDir]);
      const t = new VirtualTreeContainer([
        {
          dirPath: APP_PATH,
          children: [
            `${APP_NAME}.webapplication-meta.xml`,
            { name: 'webapplication.json', data: Buffer.from(JSON.stringify(config)) },
          ],
        },
        distDir,
      ]);
      const expected = new SourceComponent(
        { name: APP_NAME, type: registry.types.webapplication, content: APP_PATH, xml: META_FILE },
        t,
        forceIgnore
      );
      expect(a.getComponent(APP_PATH)).to.deep.equal(expected);
    });

    it('should throw when one of multiple rewrites is missing', () => {
      const config = {
        outputDir: 'dist',
        routing: {
          trailingSlash: 'never',
          fallback: '/index.html',
          rewrites: [
            { route: '/api/*', rewrite: '/api.html' },
            { route: '/docs/*', rewrite: '/missing-docs.html' },
            { route: '/admin', rewrite: '/admin.html' },
          ],
        },
      };
      const distDir: VirtualDirectory = {
        dirPath: DIST_PATH,
        children: [
          { name: 'index.html', data: Buffer.from('<html>test</html>') },
          { name: 'api.html', data: Buffer.from('<html>api</html>') },
          { name: 'admin.html', data: Buffer.from('<html>admin</html>') },
        ],
      };
      const a = adapterWith(config, [distDir]);
      const expectedPath = join(DIST_PATH, 'missing-docs.html');
      assert.throws(
        () => a.getComponent(APP_PATH),
        SfError,
        `A rewrite target defined in webapplication.json -> routing.rewrites was not found: ${expectedPath}. Ensure the file exists at that location.`
      );
    });
  });
});
