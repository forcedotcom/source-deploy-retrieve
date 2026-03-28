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
import { assert, expect } from 'chai';
import { Messages, SfError } from '@salesforce/core';
import {
  ForceIgnore,
  NodeFSTreeContainer,
  RegistryAccess,
  SourceComponent,
  VirtualDirectory,
  VirtualTreeContainer,
  registry,
} from '../../../src';
import { WebApplicationsSourceAdapter } from '../../../src/resolve/adapters';
import { RegistryTestUtil } from '../registryTestUtil';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/source-deploy-retrieve', 'sdr');

const BASE_PATH = join('path', 'to', registry.types.webapplication.directoryName);
const APP_NAME = 'Zenith';
const APP_PATH = join(BASE_PATH, APP_NAME);
const META_FILE = join(APP_PATH, `${APP_NAME}.uibundle-meta.xml`);
const JSON_FILE = join(APP_PATH, 'webapplication.json');
const CONTENT_FILE = join(APP_PATH, 'src', 'index.html');

/** Helper: builds a VirtualTreeContainer with webapplication.json and optional outputDir files. */
function buildTree(
  jsonContent: object | string,
  options?: {
    outputDir?: string;
    outputDirFiles?: string[];
    includeOutputDir?: boolean;
    outputDirStructure?: VirtualDirectory[];
  }
): VirtualTreeContainer {
  const jsonData = typeof jsonContent === 'string' ? jsonContent : JSON.stringify(jsonContent);
  const outputDir = options?.outputDir ?? 'src';
  const outputDirPath = join(APP_PATH, outputDir);
  const outputDirFiles = options?.outputDirFiles ?? ['index.html'];
  const includeOutputDir = options?.includeOutputDir !== false;
  const outputDirs = options?.outputDirStructure ?? [{ dirPath: outputDirPath, children: outputDirFiles }];

  const appChildren: Array<string | { name: string; data: Buffer }> = [
    `${APP_NAME}.uibundle-meta.xml`,
    { name: 'webapplication.json', data: Buffer.from(jsonData) },
    ...(includeOutputDir ? [outputDir] : []),
  ];

  const vfs: VirtualDirectory[] = [
    { dirPath: APP_PATH, children: appChildren },
    ...(includeOutputDir ? outputDirs : []),
  ];
  return new VirtualTreeContainer(vfs);
}

describe('WebApplicationsSourceAdapter', () => {
  const registryAccess = new RegistryAccess();
  const forceIgnore = new ForceIgnore();
  const tree = buildTree({ outputDir: 'src' });
  const adapter = new WebApplicationsSourceAdapter(registry.types.webapplication, registryAccess, forceIgnore, tree);

  const expectedComponent = new SourceComponent(
    {
      name: APP_NAME,
      type: registry.types.webapplication,
      content: APP_PATH,
      xml: META_FILE,
    },
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

  it('should throw ExpectedSourceFilesError if metadata xml is missing', () => {
    const noXmlVfs: VirtualDirectory[] = [
      {
        dirPath: APP_PATH,
        children: [{ name: 'webapplication.json', data: Buffer.from(JSON.stringify({ outputDir: 'src' })) }, 'src'],
      },
      { dirPath: join(APP_PATH, 'src'), children: ['index.html'] },
    ];
    const noXmlTree = new VirtualTreeContainer(noXmlVfs);
    const noXmlAdapter = new WebApplicationsSourceAdapter(
      registry.types.webapplication,
      registryAccess,
      forceIgnore,
      noXmlTree
    );
    const expectedXmlPath = join(APP_PATH, `${APP_NAME}.uibundle-meta.xml`);
    assert.throws(
      () => noXmlAdapter.getComponent(APP_PATH),
      SfError,
      messages.getMessage('error_expected_source_files', [expectedXmlPath, registry.types.webapplication.name])
    );
  });

  it('should skip outputDir validation for VirtualTreeContainer (content files missing)', () => {
    const noContentTree = buildTree({ outputDir: 'dist' }, { outputDir: 'dist', includeOutputDir: false });
    const noContentAdapter = new WebApplicationsSourceAdapter(
      registry.types.webapplication,
      registryAccess,
      forceIgnore,
      noContentTree
    );
    const comp = noContentAdapter.getComponent(APP_PATH);
    expect(comp).to.not.be.undefined;
  });

  it('should succeed when webapplication.json is absent (file-based routing)', () => {
    const vfs: VirtualDirectory[] = [
      { dirPath: APP_PATH, children: [`${APP_NAME}.uibundle-meta.xml`, 'src'] },
      { dirPath: join(APP_PATH, 'src'), children: ['index.html'] },
    ];
    const noJsonTree = new VirtualTreeContainer(vfs);
    const noJsonAdapter = new WebApplicationsSourceAdapter(
      registry.types.webapplication,
      registryAccess,
      forceIgnore,
      noJsonTree
    );
    const comp = noJsonAdapter.getComponent(APP_PATH);
    expect(comp).to.not.be.undefined;
    expect(comp!.name).to.equal(APP_NAME);
  });

  it('should allow missing webapplication.json when resolving metadata', () => {
    const metadataTree = VirtualTreeContainer.fromFilePaths([META_FILE]);
    const metadataAdapter = new WebApplicationsSourceAdapter(
      registry.types.webapplication,
      registryAccess,
      forceIgnore,
      metadataTree
    );
    const expectedMetadataComponent = new SourceComponent(
      {
        name: APP_NAME,
        type: registry.types.webapplication,
        content: APP_PATH,
        xml: META_FILE,
      },
      metadataTree,
      forceIgnore
    );

    expect(metadataAdapter.getComponent(META_FILE, false)).to.deep.equal(expectedMetadataComponent);
  });

  it('should succeed when webapplication.json is forceignored (skip validation, treat as absent)', () => {
    const testUtil = new RegistryTestUtil();
    const fi = testUtil.stubForceIgnore({
      seed: APP_PATH,
      deny: [JSON_FILE],
    });
    const ignoredAdapter = new WebApplicationsSourceAdapter(registry.types.webapplication, registryAccess, fi, tree);

    const comp = ignoredAdapter.getComponent(APP_PATH);
    expect(comp).to.not.be.undefined;
    expect(comp!.name).to.equal(APP_NAME);
    testUtil.restore();
  });

  describe('webapplication.json validation (VirtualTreeContainer — validation skipped)', () => {
    const expectValidationSkipped = (jsonContent: object | string, options?: Parameters<typeof buildTree>[1]) => {
      const t = buildTree(jsonContent, options);
      const a = new WebApplicationsSourceAdapter(registry.types.webapplication, registryAccess, forceIgnore, t);
      expect(a.getComponent(APP_PATH)).to.not.be.undefined;
    };

    const expectPass = (jsonContent: object, options?: Parameters<typeof buildTree>[1]) => {
      const t = buildTree(jsonContent, options);
      const a = new WebApplicationsSourceAdapter(registry.types.webapplication, registryAccess, forceIgnore, t);
      expect(a.getComponent(APP_PATH)).to.not.be.undefined;
    };

    describe('Structure & Content', () => {
      it('empty file - skipped', () => {
        const vfs: VirtualDirectory[] = [
          {
            dirPath: APP_PATH,
            children: [`${APP_NAME}.uibundle-meta.xml`, { name: 'webapplication.json', data: Buffer.from('') }, 'src'],
          },
          { dirPath: join(APP_PATH, 'src'), children: ['index.html'] },
        ];
        const t = new VirtualTreeContainer(vfs);
        const a = new WebApplicationsSourceAdapter(registry.types.webapplication, registryAccess, forceIgnore, t);
        expect(a.getComponent(APP_PATH)).to.not.be.undefined;
      });

      it('whitespace only - skipped', () => {
        expectValidationSkipped('   \n  \t  ');
      });

      it('invalid JSON - skipped', () => {
        expectValidationSkipped('{"unclosed');
      });

      it('root is array - skipped', () => {
        expectValidationSkipped('[{"outputDir":"dist"}]');
      });

      it('empty root object - skipped', () => {
        expectValidationSkipped({});
      });

      it('non-empty root - pass', () => {
        expectPass({ outputDir: 'src' });
      });
    });

    describe('Types & Formats', () => {
      it('apiVersion is unknown property - skipped', () => {
        expectValidationSkipped({ apiVersion: '66.0' } as unknown as object);
      });

      it('outputDir empty string - skipped', () => {
        expectValidationSkipped({ outputDir: '' });
      });

      it('outputDir wrong type - skipped', () => {
        expectValidationSkipped({ outputDir: 123 } as unknown as object);
      });

      it('routing wrong type - skipped', () => {
        expectValidationSkipped({ routing: 'invalid' } as unknown as object);
      });

      it('headers wrong type - skipped', () => {
        expectValidationSkipped({ headers: 'invalid' } as unknown as object);
      });

      it('trailingSlash invalid - skipped', () => {
        expectValidationSkipped({ routing: { trailingSlash: 'sometimes' } });
      });

      it('statusCode invalid - skipped', () => {
        expectValidationSkipped({
          outputDir: 'dist',
          routing: { redirects: [{ route: '/a', redirect: '/b', statusCode: 200 }] },
        } as unknown as object);
      });
    });

    describe('Empty Objects & Arrays', () => {
      it('empty routing - skipped', () => {
        expectValidationSkipped({ outputDir: 'src', routing: {} });
      });

      it('empty rewrites array - skipped', () => {
        expectValidationSkipped({ outputDir: 'src', routing: { rewrites: [] } });
      });

      it('empty rewrite item - skipped', () => {
        expectValidationSkipped({ outputDir: 'src', routing: { rewrites: [{}] } });
      });

      it('empty redirects array - skipped', () => {
        expectValidationSkipped({ outputDir: 'src', routing: { redirects: [] } });
      });

      it('empty redirect item - skipped', () => {
        expectValidationSkipped({ outputDir: 'src', routing: { redirects: [{}] } });
      });

      it('empty headers array - skipped', () => {
        expectValidationSkipped({ outputDir: 'src', headers: [] });
      });

      it('empty headers item - skipped', () => {
        expectValidationSkipped({ outputDir: 'src', headers: [{}] });
      });

      it('empty header key-value - skipped', () => {
        expectValidationSkipped({
          outputDir: 'src',
          headers: [{ source: '/*', headers: [{}] }],
        });
      });

      it('empty nested headers array - skipped', () => {
        expectValidationSkipped({
          outputDir: 'src',
          headers: [{ source: '/*', headers: [] }],
        });
      });
    });

    describe('File Existence', () => {
      it('outputDir points to non-existent dir - skipped', () => {
        expectValidationSkipped({ outputDir: 'dist' }, { outputDir: 'dist', includeOutputDir: false });
      });

      it('fallback file does not exist - skipped', () => {
        expectValidationSkipped(
          { outputDir: 'dist', routing: { fallback: 'missing.html' } },
          { outputDir: 'dist', outputDirFiles: ['index.html'] }
        );
      });

      it('rewrite target file does not exist - skipped', () => {
        expectValidationSkipped(
          { outputDir: 'dist', routing: { rewrites: [{ rewrite: 'pages/missing.html' }] } },
          { outputDir: 'dist', outputDirFiles: ['index.html'] }
        );
      });
    });

    describe('Path Traversal & Dangerous Characters', () => {
      it('outputDir with ../ traversal - skipped', () => {
        expectValidationSkipped({ outputDir: '../../../etc' }, { includeOutputDir: false });
      });

      it('outputDir that is exactly ".." - skipped', () => {
        expectValidationSkipped({ outputDir: '..' }, { includeOutputDir: false });
      });

      it('outputDir with nested .. - skipped', () => {
        expectValidationSkipped({ outputDir: 'a/../../b' }, { includeOutputDir: false });
      });

      it('outputDir with trailing .. - skipped', () => {
        expectValidationSkipped({ outputDir: 'a/b/..' }, { includeOutputDir: false });
      });

      it('fallback with ../ traversal - skipped', () => {
        expectValidationSkipped({ outputDir: 'src', routing: { fallback: '../../etc/passwd' } });
      });

      it('rewrite target with ../ traversal - skipped', () => {
        expectValidationSkipped({ outputDir: 'src', routing: { rewrites: [{ rewrite: '../../../etc/passwd' }] } });
      });

      it('absolute outputDir starting with / - skipped', () => {
        expectValidationSkipped({ outputDir: '/etc' }, { includeOutputDir: false });
      });

      it('absolute outputDir starting with backslash - skipped', () => {
        expectValidationSkipped({ outputDir: '\\Windows' }, { includeOutputDir: false });
      });

      it('absolute fallback path - skipped', () => {
        expectValidationSkipped({ outputDir: 'src', routing: { fallback: '/index.html' } });
      });

      it('outputDir with null byte - skipped', () => {
        expectValidationSkipped({ outputDir: 'dist\0' }, { includeOutputDir: false });
      });

      it('outputDir with tab character - skipped', () => {
        expectValidationSkipped({ outputDir: 'dist\t' }, { includeOutputDir: false });
      });

      it('outputDir with newline - skipped', () => {
        expectValidationSkipped({ outputDir: 'dist\n' }, { includeOutputDir: false });
      });

      it('outputDir with * wildcard - skipped', () => {
        expectValidationSkipped({ outputDir: 'dist/*' }, { includeOutputDir: false });
      });

      it('outputDir with ? wildcard - skipped', () => {
        expectValidationSkipped({ outputDir: 'dis?' }, { includeOutputDir: false });
      });

      it('rewrite target with * wildcard - skipped', () => {
        expectValidationSkipped({ outputDir: 'src', routing: { rewrites: [{ rewrite: '*.html' }] } });
      });

      it('outputDir with ** glob - skipped', () => {
        expectValidationSkipped({ outputDir: 'dist/**' }, { includeOutputDir: false });
      });

      it('outputDir with backslash in the middle - skipped', () => {
        expectValidationSkipped({ outputDir: 'a\\b' }, { includeOutputDir: false });
      });

      it('outputDir with backslash traversal - skipped', () => {
        expectValidationSkipped({ outputDir: '..\\etc' }, { includeOutputDir: false });
      });

      it('outputDir with percent-encoding - skipped', () => {
        expectValidationSkipped({ outputDir: '%2e%2e' }, { includeOutputDir: false });
      });

      it('fallback with percent-encoding - skipped', () => {
        expectValidationSkipped({ outputDir: 'src', routing: { fallback: '%2findex.html' } });
      });

      it('outputDir "." (resolves to bundle root) - skipped', () => {
        expectValidationSkipped({ outputDir: '.' });
      });

      it('allows outputDir with double dot inside filename (file..name)', () => {
        expectPass({ outputDir: 'file..name' }, { outputDir: 'file..name', outputDirFiles: ['index.html'] });
      });
    });

    describe('Fallback/Rewrite Without outputDir', () => {
      it('succeeds when fallback file exists at bundle root', () => {
        const vfs: VirtualDirectory[] = [
          {
            dirPath: APP_PATH,
            children: [
              `${APP_NAME}.uibundle-meta.xml`,
              {
                name: 'webapplication.json',
                data: Buffer.from(JSON.stringify({ routing: { fallback: 'index.html' } })),
              },
              'src',
              'index.html',
            ],
          },
          { dirPath: join(APP_PATH, 'src'), children: ['app.js'] },
        ];
        const t = new VirtualTreeContainer(vfs);
        const a = new WebApplicationsSourceAdapter(registry.types.webapplication, registryAccess, forceIgnore, t);
        expect(a.getComponent(APP_PATH)).to.not.be.undefined;
      });

      it('missing fallback file - validation skipped (VirtualTreeContainer)', () => {
        const vfs: VirtualDirectory[] = [
          {
            dirPath: APP_PATH,
            children: [
              `${APP_NAME}.uibundle-meta.xml`,
              {
                name: 'webapplication.json',
                data: Buffer.from(JSON.stringify({ routing: { fallback: 'missing.html' } })),
              },
              'src',
            ],
          },
          { dirPath: join(APP_PATH, 'src'), children: ['other.html'] },
        ];
        const t = new VirtualTreeContainer(vfs);
        const a = new WebApplicationsSourceAdapter(registry.types.webapplication, registryAccess, forceIgnore, t);
        expect(a.getComponent(APP_PATH)).to.not.be.undefined;
      });

      it('succeeds when rewrite target exists at bundle root', () => {
        const vfs: VirtualDirectory[] = [
          {
            dirPath: APP_PATH,
            children: [
              `${APP_NAME}.uibundle-meta.xml`,
              {
                name: 'webapplication.json',
                data: Buffer.from(JSON.stringify({ routing: { rewrites: [{ rewrite: 'index.html' }] } })),
              },
              'src',
              'index.html',
            ],
          },
          { dirPath: join(APP_PATH, 'src'), children: ['app.js'] },
        ];
        const t = new VirtualTreeContainer(vfs);
        const a = new WebApplicationsSourceAdapter(registry.types.webapplication, registryAccess, forceIgnore, t);
        expect(a.getComponent(APP_PATH)).to.not.be.undefined;
      });

      it('missing rewrite target - validation skipped (VirtualTreeContainer)', () => {
        const vfs: VirtualDirectory[] = [
          {
            dirPath: APP_PATH,
            children: [
              `${APP_NAME}.uibundle-meta.xml`,
              {
                name: 'webapplication.json',
                data: Buffer.from(JSON.stringify({ routing: { rewrites: [{ rewrite: 'missing.html' }] } })),
              },
              'src',
            ],
          },
          { dirPath: join(APP_PATH, 'src'), children: ['other.html'] },
        ];
        const t = new VirtualTreeContainer(vfs);
        const a = new WebApplicationsSourceAdapter(registry.types.webapplication, registryAccess, forceIgnore, t);
        expect(a.getComponent(APP_PATH)).to.not.be.undefined;
      });
    });

    describe('Size Limit', () => {
      it('webapplication.json over 100 KB - skipped', () => {
        const filler = Array.from({ length: 2000 }, (_, i) => ({
          source: `/${'a'.repeat(20)}${i}`,
          headers: [{ key: 'X-Pad', value: 'x'.repeat(30) }],
        }));
        const oversized = JSON.stringify({ outputDir: 'src', headers: filler });
        expect(Buffer.byteLength(oversized)).to.be.greaterThan(102_400);
        expectValidationSkipped(oversized);
      });

      it('allows webapplication.json just under 100 KB', () => {
        const filler = Array.from({ length: 800 }, (_, i) => ({
          source: `/${i}`,
          headers: [{ key: 'X-Pad', value: 'x'.repeat(50) }],
        }));
        const content = JSON.stringify({ outputDir: 'src', headers: filler });
        expect(Buffer.byteLength(content)).to.be.lessThanOrEqual(102_400);
        expectPass(JSON.parse(content) as object);
      });
    });

    describe('Valid Cases', () => {
      it('only outputDir - pass', () => {
        expectPass({ outputDir: 'src' });
      });

      it('only routing (fileBasedRouting) - pass', () => {
        expectPass({ routing: { fileBasedRouting: false } });
      });

      it('only routing (trailingSlash) - pass', () => {
        expectPass({ routing: { trailingSlash: 'always' } });
      });

      it('only headers - pass', () => {
        expectPass({
          headers: [{ source: '/*', headers: [{ key: 'X-Custom', value: 'test' }] }],
        });
      });

      it('rewrite with only rewrite field - pass', () => {
        expectPass(
          { outputDir: 'dist', routing: { rewrites: [{ rewrite: 'pages/user.html' }] } },
          {
            outputDir: 'dist',
            outputDirStructure: [
              { dirPath: join(APP_PATH, 'dist'), children: ['pages'] },
              { dirPath: join(APP_PATH, 'dist', 'pages'), children: ['user.html'] },
            ],
          }
        );
      });

      it('rewrite with only route field - pass', () => {
        expectPass({ routing: { rewrites: [{ route: '/users/:id' }] } });
      });

      it('redirect with only redirect - pass', () => {
        expectPass({ routing: { redirects: [{ redirect: '/new-path' }] } });
      });

      it('headers with only source - pass', () => {
        expectPass({ headers: [{ source: '/*' }] });
      });

      it('additional property at root - skipped', () => {
        expectValidationSkipped({ outputDir: 'src', customField: 'x' } as unknown as object);
      });

      it('non-empty strings for route/rewrite - pass', () => {
        expectPass(
          { outputDir: 'dist', routing: { rewrites: [{ route: '/a', rewrite: 'b.html' }] } },
          { outputDir: 'dist', outputDirFiles: ['b.html'] }
        );
      });
    });

    describe('error message quality (VirtualTreeContainer — validation skipped)', () => {
      it('no validation errors are produced for any invalid input', () => {
        const cases: Array<{ input: object | string; options?: Parameters<typeof buildTree>[1] }> = [
          { input: { outputDir: 123 } as unknown as object },
          { input: { routing: { trailingSlash: 'sometimes' } } },
          {
            input: { routing: { redirects: [{ route: '/a', redirect: '/b', statusCode: 200 }] } } as unknown as object,
          },
          {
            input: { outputDir: 'dist', routing: { rewrites: [{ rewrite: 'missing.html' }] } },
            options: { outputDir: 'dist', outputDirFiles: ['other.html'] },
          },
          { input: { outputDir: 'src', foo: 1, bar: 2 } as unknown as object },
          { input: '[1,2,3]' },
          { input: {} },
          { input: { outputDir: 'dist' }, options: { outputDir: 'dist', includeOutputDir: false } },
          { input: { routing: { redirects: [{ route: '', redirect: '/b' }] } } },
        ];
        for (const { input, options } of cases) {
          const t = buildTree(input, options);
          const a = new WebApplicationsSourceAdapter(registry.types.webapplication, registryAccess, forceIgnore, t);
          expect(() => a.getComponent(APP_PATH)).to.not.throw();
        }
      });

      it('empty webapplication.json does not throw with VirtualTreeContainer', () => {
        const vfs: VirtualDirectory[] = [
          {
            dirPath: APP_PATH,
            children: [`${APP_NAME}.uibundle-meta.xml`, { name: 'webapplication.json', data: Buffer.from('') }, 'src'],
          },
          { dirPath: join(APP_PATH, 'src'), children: ['index.html'] },
        ];
        const t = new VirtualTreeContainer(vfs);
        const a = new WebApplicationsSourceAdapter(registry.types.webapplication, registryAccess, forceIgnore, t);
        expect(() => a.getComponent(APP_PATH)).to.not.throw();
      });
    });
  });

  describe('VirtualTreeContainer skips validation', () => {
    it('empty webapplication.json resolves successfully', () => {
      const vfs: VirtualDirectory[] = [
        {
          dirPath: APP_PATH,
          children: [`${APP_NAME}.uibundle-meta.xml`, { name: 'webapplication.json', data: Buffer.from('') }, 'src'],
        },
        { dirPath: join(APP_PATH, 'src'), children: ['index.html'] },
      ];
      const t = new VirtualTreeContainer(vfs);
      const a = new WebApplicationsSourceAdapter(registry.types.webapplication, registryAccess, forceIgnore, t);
      expect(a.getComponent(APP_PATH)).to.not.be.undefined;
    });

    it('invalid JSON resolves successfully', () => {
      const t = buildTree('{"unclosed');
      const a = new WebApplicationsSourceAdapter(registry.types.webapplication, registryAccess, forceIgnore, t);
      expect(a.getComponent(APP_PATH)).to.not.be.undefined;
    });

    it('path traversal content resolves successfully', () => {
      const t = buildTree({ outputDir: '../../../etc' }, { includeOutputDir: false });
      const a = new WebApplicationsSourceAdapter(registry.types.webapplication, registryAccess, forceIgnore, t);
      expect(a.getComponent(APP_PATH)).to.not.be.undefined;
    });
  });

  describe('NodeFSTreeContainer runs validation', () => {
    let tmpDir: string;
    let appDir: string;

    beforeEach(() => {
      tmpDir = mkdtempSync(join(tmpdir(), 'webapp-test-'));
      const webappsDir = join(tmpDir, registry.types.webapplication.directoryName);
      appDir = join(webappsDir, 'TestApp');
      mkdirSync(appDir, { recursive: true });
      mkdirSync(join(appDir, 'dist'), { recursive: true });
      writeFileSync(join(appDir, 'TestApp.uibundle-meta.xml'), '<WebApplication/>');
      writeFileSync(join(appDir, 'dist', 'index.html'), '<html/>');
    });

    afterEach(() => {
      rmSync(tmpDir, { recursive: true, force: true });
    });

    it('should validate and succeed for valid content', () => {
      writeFileSync(join(appDir, 'webapplication.json'), JSON.stringify({ outputDir: 'dist' }));
      const fsTree = new NodeFSTreeContainer();
      const a = new WebApplicationsSourceAdapter(registry.types.webapplication, registryAccess, forceIgnore, fsTree);
      const comp = a.getComponent(appDir);
      expect(comp).to.not.be.undefined;
      expect(comp!.name).to.equal('TestApp');
    });

    it('should throw for empty file', () => {
      writeFileSync(join(appDir, 'webapplication.json'), '');
      const fsTree = new NodeFSTreeContainer();
      const a = new WebApplicationsSourceAdapter(registry.types.webapplication, registryAccess, forceIgnore, fsTree);
      assert.throws(() => a.getComponent(appDir), SfError, /must not be empty/);
    });

    it('should throw for invalid JSON', () => {
      writeFileSync(join(appDir, 'webapplication.json'), '{"unclosed');
      const fsTree = new NodeFSTreeContainer();
      const a = new WebApplicationsSourceAdapter(registry.types.webapplication, registryAccess, forceIgnore, fsTree);
      assert.throws(() => a.getComponent(appDir), SfError, /webapplication\.json/);
    });

    it('should skip when webapplication.json is absent', () => {
      const fsTree = new NodeFSTreeContainer();
      const a = new WebApplicationsSourceAdapter(registry.types.webapplication, registryAccess, forceIgnore, fsTree);
      const comp = a.getComponent(appDir);
      expect(comp).to.not.be.undefined;
    });
  });

  describe('app name case', () => {
    const buildAdapterWithAppName = (appName: string) => {
      const appPath = join(BASE_PATH, appName);
      const metaFile = join(appPath, `${appName}.uibundle-meta.xml`);
      const config = { outputDir: 'src', routing: { trailingSlash: 'auto', fallback: 'index.html' } };
      const vfs: VirtualDirectory[] = [
        {
          dirPath: appPath,
          children: [
            `${appName}.uibundle-meta.xml`,
            { name: 'webapplication.json', data: Buffer.from(JSON.stringify(config)) },
            'src',
          ],
        },
        { dirPath: join(appPath, 'src'), children: ['index.html'] },
      ];
      const t = new VirtualTreeContainer(vfs);
      return {
        adapter: new WebApplicationsSourceAdapter(registry.types.webapplication, registryAccess, forceIgnore, t),
        appPath,
        metaFile,
      };
    };

    it('should preserve mixed-case app name (MyApp)', () => {
      const { adapter, appPath, metaFile } = buildAdapterWithAppName('MyApp');
      const comp = adapter.getComponent(appPath);
      expect(comp).to.not.be.undefined;
      expect(comp!.name).to.equal('MyApp');
      expect(comp!.fullName).to.equal('MyApp');
      expect(comp!.xml).to.equal(metaFile);
    });

    it('should preserve lowercase app name (myapp)', () => {
      const { adapter, appPath } = buildAdapterWithAppName('myapp');
      const comp = adapter.getComponent(appPath);
      expect(comp).to.not.be.undefined;
      expect(comp!.name).to.equal('myapp');
      expect(comp!.fullName).to.equal('myapp');
    });

    it('should preserve uppercase app name (MYAPP)', () => {
      const { adapter, appPath } = buildAdapterWithAppName('MYAPP');
      const comp = adapter.getComponent(appPath);
      expect(comp).to.not.be.undefined;
      expect(comp!.name).to.equal('MYAPP');
      expect(comp!.fullName).to.equal('MYAPP');
    });
  });
});
