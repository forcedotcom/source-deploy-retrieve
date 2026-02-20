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
const META_FILE = join(APP_PATH, `${APP_NAME}.webapplication-meta.xml`);
const JSON_FILE = join(APP_PATH, 'webapplication.json');
const CONTENT_FILE = join(APP_PATH, 'src', 'index.html');

/** Build a tree with given webapplication.json content. Optionally include outputDir with files. */
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
    `${APP_NAME}.webapplication-meta.xml`,
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
    const expectedXmlPath = join(APP_PATH, `${APP_NAME}.webapplication-meta.xml`);
    assert.throws(
      () => noXmlAdapter.getComponent(APP_PATH),
      SfError,
      messages.getMessage('error_expected_source_files', [expectedXmlPath, registry.types.webapplication.name])
    );
  });

  it('should throw ExpectedSourceFilesError if content files are missing', () => {
    const noContentTree = buildTree({ outputDir: 'dist' }, { outputDir: 'dist', includeOutputDir: false });
    const noContentAdapter = new WebApplicationsSourceAdapter(
      registry.types.webapplication,
      registryAccess,
      forceIgnore,
      noContentTree
    );
    assert.throws(() => noContentAdapter.getComponent(APP_PATH), SfError, /outputDir.*directory does not exist/);
  });

  it('should succeed when webapplication.json is absent (file-based routing)', () => {
    const vfs: VirtualDirectory[] = [
      { dirPath: APP_PATH, children: [`${APP_NAME}.webapplication-meta.xml`, 'src'] },
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

  describe('webapplication.json validation', () => {
    const expectFail = (jsonContent: object | string, options?: Parameters<typeof buildTree>[1]) => {
      const t = buildTree(jsonContent, options);
      const a = new WebApplicationsSourceAdapter(registry.types.webapplication, registryAccess, forceIgnore, t);
      assert.throws(() => a.getComponent(APP_PATH), SfError, /webapplication\.json|outputDir|ExpectedSourceFilesError/);
    };

    const expectPass = (jsonContent: object, options?: Parameters<typeof buildTree>[1]) => {
      const t = buildTree(jsonContent, options);
      const a = new WebApplicationsSourceAdapter(registry.types.webapplication, registryAccess, forceIgnore, t);
      expect(a.getComponent(APP_PATH)).to.not.be.undefined;
    };

    describe('Structure & Content', () => {
      it('empty file - fail', () => {
        const vfs: VirtualDirectory[] = [
          {
            dirPath: APP_PATH,
            children: [
              `${APP_NAME}.webapplication-meta.xml`,
              { name: 'webapplication.json', data: Buffer.from('') },
              'src',
            ],
          },
          { dirPath: join(APP_PATH, 'src'), children: ['index.html'] },
        ];
        const t = new VirtualTreeContainer(vfs);
        const a = new WebApplicationsSourceAdapter(registry.types.webapplication, registryAccess, forceIgnore, t);
        assert.throws(() => a.getComponent(APP_PATH), SfError, /must not be empty/);
      });

      it('whitespace only - fail', () => {
        expectFail('   \n  \t  ');
      });

      it('invalid JSON - fail', () => {
        expectFail('{"unclosed');
      });

      it('root is array - fail', () => {
        expectFail('[{"outputDir":"dist"}]');
      });

      it('empty root object - fail', () => {
        expectFail({});
      });

      it('non-empty root - pass', () => {
        expectPass({ outputDir: 'src' });
      });
    });

    describe('Types & Formats', () => {
      it('apiVersion wrong type - fail', () => {
        expectFail({ apiVersion: 66.0 } as unknown as object);
      });

      it('apiVersion invalid format - fail', () => {
        expectFail({ apiVersion: '66' });
      });

      it('apiVersion valid - pass', () => {
        expectPass({ apiVersion: '66.0' });
      });

      it('outputDir empty string - fail', () => {
        expectFail({ outputDir: '' });
      });

      it('outputDir wrong type - fail', () => {
        expectFail({ outputDir: 123 } as unknown as object);
      });

      it('routing wrong type - fail', () => {
        expectFail({ routing: 'invalid' } as unknown as object);
      });

      it('headers wrong type - fail', () => {
        expectFail({ headers: 'invalid' } as unknown as object);
      });

      it('trailingSlash invalid - fail', () => {
        expectFail({ routing: { trailingSlash: 'sometimes' } });
      });

      it('statusCode invalid - fail', () => {
        expectFail({
          outputDir: 'dist',
          routing: { redirects: [{ route: '/a', redirect: '/b', statusCode: 200 }] },
        } as unknown as object);
      });
    });

    describe('Empty Objects & Arrays', () => {
      it('empty routing - fail', () => {
        expectFail({ outputDir: 'src', routing: {} });
      });

      it('empty rewrites array - fail', () => {
        expectFail({ outputDir: 'src', routing: { rewrites: [] } });
      });

      it('empty rewrite item - fail', () => {
        expectFail({ outputDir: 'src', routing: { rewrites: [{}] } });
      });

      it('empty redirects array - fail', () => {
        expectFail({ outputDir: 'src', routing: { redirects: [] } });
      });

      it('empty redirect item - fail', () => {
        expectFail({ outputDir: 'src', routing: { redirects: [{}] } });
      });

      it('empty headers array - fail', () => {
        expectFail({ outputDir: 'src', headers: [] });
      });

      it('empty headers item - fail', () => {
        expectFail({ outputDir: 'src', headers: [{}] });
      });

      it('empty header key-value - fail', () => {
        expectFail({
          outputDir: 'src',
          headers: [{ source: '/*', headers: [{}] }],
        });
      });

      it('empty nested headers array - fail', () => {
        expectFail({
          outputDir: 'src',
          headers: [{ source: '/*', headers: [] }],
        });
      });
    });

    describe('File Existence', () => {
      it('outputDir points to non-existent dir - fail', () => {
        expectFail({ outputDir: 'dist' }, { outputDir: 'dist', includeOutputDir: false });
      });

      it('fallback file does not exist - fail', () => {
        expectFail(
          { outputDir: 'dist', routing: { fallback: 'missing.html' } },
          { outputDir: 'dist', outputDirFiles: ['index.html'] }
        );
      });

      it('rewrite target file does not exist - fail', () => {
        expectFail(
          { outputDir: 'dist', routing: { rewrites: [{ rewrite: 'pages/missing.html' }] } },
          { outputDir: 'dist', outputDirFiles: ['index.html'] }
        );
      });
    });

    describe('Path Traversal & Dangerous Characters', () => {
      /* ".." segments */
      it('rejects outputDir with ../ traversal', () => {
        expectFail({ outputDir: '../../../etc' }, { includeOutputDir: false });
      });

      it('rejects outputDir that is exactly ".."', () => {
        expectFail({ outputDir: '..' }, { includeOutputDir: false });
      });

      it('rejects outputDir with nested ..', () => {
        expectFail({ outputDir: 'a/../../b' }, { includeOutputDir: false });
      });

      it('rejects outputDir with trailing ..', () => {
        expectFail({ outputDir: 'a/b/..' }, { includeOutputDir: false });
      });

      it('rejects fallback with ../ traversal', () => {
        expectFail({ outputDir: 'src', routing: { fallback: '../../etc/passwd' } });
      });

      it('rejects rewrite target with ../ traversal', () => {
        expectFail({ outputDir: 'src', routing: { rewrites: [{ rewrite: '../../../etc/passwd' }] } });
      });

      /* absolute paths */
      it('rejects absolute outputDir starting with /', () => {
        expectFail({ outputDir: '/etc' }, { includeOutputDir: false });
      });

      it('rejects absolute outputDir starting with backslash', () => {
        expectFail({ outputDir: '\\Windows' }, { includeOutputDir: false });
      });

      it('rejects absolute fallback path', () => {
        expectFail({ outputDir: 'src', routing: { fallback: '/index.html' } });
      });

      /* null byte */
      it('rejects outputDir with null byte', () => {
        expectFail({ outputDir: 'dist\0' }, { includeOutputDir: false });
      });

      /* control characters */
      it('rejects outputDir with tab character', () => {
        expectFail({ outputDir: 'dist\t' }, { includeOutputDir: false });
      });

      it('rejects outputDir with newline', () => {
        expectFail({ outputDir: 'dist\n' }, { includeOutputDir: false });
      });

      /* glob wildcards */
      it('rejects outputDir with * wildcard', () => {
        expectFail({ outputDir: 'dist/*' }, { includeOutputDir: false });
      });

      it('rejects outputDir with ? wildcard', () => {
        expectFail({ outputDir: 'dis?' }, { includeOutputDir: false });
      });

      it('rejects rewrite target with * wildcard', () => {
        expectFail({ outputDir: 'src', routing: { rewrites: [{ rewrite: '*.html' }] } });
      });

      /* double-star glob */
      it('rejects outputDir with ** glob', () => {
        expectFail({ outputDir: 'dist/**' }, { includeOutputDir: false });
      });

      /* backslash mid-path */
      it('rejects outputDir with backslash in the middle', () => {
        expectFail({ outputDir: 'a\\b' }, { includeOutputDir: false });
      });

      /* backslash traversal (..\) */
      it('rejects outputDir with backslash traversal (..\\)', () => {
        expectFail({ outputDir: '..\\etc' }, { includeOutputDir: false });
      });

      /* percent-encoding */
      it('rejects outputDir with percent-encoding', () => {
        expectFail({ outputDir: '%2e%2e' }, { includeOutputDir: false });
      });

      it('rejects fallback with percent-encoding', () => {
        expectFail({ outputDir: 'src', routing: { fallback: '%2findex.html' } });
      });

      /* outputDir normalizes to bundle root */
      it('rejects outputDir "." (resolves to bundle root)', () => {
        expectFail({ outputDir: '.' });
      });

      /* "file..name" is allowed — double dot inside a filename is not a ".." segment */
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
              `${APP_NAME}.webapplication-meta.xml`,
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

      it('fails when fallback file is missing from bundle root', () => {
        const vfs: VirtualDirectory[] = [
          {
            dirPath: APP_PATH,
            children: [
              `${APP_NAME}.webapplication-meta.xml`,
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
        assert.throws(() => a.getComponent(APP_PATH), SfError, /routing\.fallback.*missing\.html/);
      });

      it('succeeds when rewrite target exists at bundle root', () => {
        const vfs: VirtualDirectory[] = [
          {
            dirPath: APP_PATH,
            children: [
              `${APP_NAME}.webapplication-meta.xml`,
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

      it('fails when rewrite target is missing from bundle root', () => {
        const vfs: VirtualDirectory[] = [
          {
            dirPath: APP_PATH,
            children: [
              `${APP_NAME}.webapplication-meta.xml`,
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
        assert.throws(() => a.getComponent(APP_PATH), SfError, /routing\.rewrites\[0\]\.rewrite.*missing\.html/);
      });
    });

    describe('Size Limit', () => {
      it('rejects webapplication.json over 100 KB', () => {
        const filler = Array.from({ length: 2000 }, (_, i) => ({
          source: `/${'a'.repeat(20)}${i}`,
          headers: [{ key: 'X-Pad', value: 'x'.repeat(30) }],
        }));
        const oversized = JSON.stringify({ outputDir: 'src', headers: filler });
        expect(Buffer.byteLength(oversized)).to.be.greaterThan(102_400);
        expectFail(oversized);
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

      it('only apiVersion - pass', () => {
        expectPass({ apiVersion: '66.0' });
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

      it('additional property at root - fail', () => {
        expectFail({ outputDir: 'src', customField: 'x' } as unknown as object);
      });

      it('non-empty strings for route/rewrite - pass', () => {
        expectPass(
          { outputDir: 'dist', routing: { rewrites: [{ route: '/a', rewrite: 'b.html' }] } },
          { outputDir: 'dist', outputDirFiles: ['b.html'] }
        );
      });
    });

    describe('error message quality', () => {
      const getError = (jsonContent: object | string, options?: Parameters<typeof buildTree>[1]): SfError => {
        const t = buildTree(jsonContent, options);
        const a = new WebApplicationsSourceAdapter(registry.types.webapplication, registryAccess, forceIgnore, t);
        try {
          a.getComponent(APP_PATH);
          throw new Error('Expected an error to be thrown');
        } catch (e) {
          return e as SfError;
        }
      };

      it('includes received type in type-mismatch errors', () => {
        const err = getError({ apiVersion: 66.0 } as unknown as object);
        expect(err.message).to.include('received number');
      });

      it('includes the actual value for invalid apiVersion format', () => {
        const err = getError({ apiVersion: '66' });
        expect(err.message).to.include('"66"');
      });

      it('includes actual value for invalid trailingSlash', () => {
        const err = getError({ routing: { trailingSlash: 'sometimes' } });
        expect(err.message).to.include('"sometimes"');
      });

      it('includes array index in statusCode error', () => {
        const err = getError({
          routing: { redirects: [{ route: '/a', redirect: '/b', statusCode: 200 }] },
        } as unknown as object);
        expect(err.message).to.include('redirects[0].statusCode');
        expect(err.message).to.include('200');
      });

      it('includes array index in rewrite file-existence error', () => {
        const err = getError(
          { outputDir: 'dist', routing: { rewrites: [{ rewrite: 'missing.html' }] } },
          { outputDir: 'dist', outputDirFiles: ['other.html'] }
        );
        expect(err.message).to.include('rewrites[0].rewrite');
        expect(err.message).to.include('"missing.html"');
      });

      it('reports all unknown top-level properties at once', () => {
        const err = getError({ outputDir: 'src', foo: 1, bar: 2 } as unknown as object);
        expect(err.message).to.include("'foo'");
        expect(err.message).to.include("'bar'");
      });

      it('describes root type when not an object', () => {
        const err = getError('[1,2,3]');
        expect(err.message).to.include('found array');
      });

      it('provides actions (suggested fixes) on structural errors', () => {
        const err = getError({});
        expect(err.actions).to.be.an('array').that.is.not.empty;
      });

      it('provides actions on file-existence errors', () => {
        const err = getError({ outputDir: 'dist' }, { outputDir: 'dist', includeOutputDir: false });
        expect(err.actions).to.be.an('array').that.is.not.empty;
        expect(err.actions![0]).to.include('dist');
      });

      it('includes file path in empty-file error', () => {
        const vfs: VirtualDirectory[] = [
          {
            dirPath: APP_PATH,
            children: [
              `${APP_NAME}.webapplication-meta.xml`,
              { name: 'webapplication.json', data: Buffer.from('') },
              'src',
            ],
          },
          { dirPath: join(APP_PATH, 'src'), children: ['index.html'] },
        ];
        const t = new VirtualTreeContainer(vfs);
        const a = new WebApplicationsSourceAdapter(registry.types.webapplication, registryAccess, forceIgnore, t);
        try {
          a.getComponent(APP_PATH);
          throw new Error('Expected an error');
        } catch (e) {
          expect((e as SfError).message).to.include('webapplication.json');
        }
      });

      it('validates redirect route as non-empty string', () => {
        const err = getError({
          routing: { redirects: [{ route: '', redirect: '/b' }] },
        });
        expect(err.message).to.include('redirects[0].route');
        expect(err.message).to.include('non-empty string');
      });
    });
  });

  describe('app name case', () => {
    const buildAdapterWithAppName = (appName: string) => {
      const appPath = join(BASE_PATH, appName);
      const metaFile = join(appPath, `${appName}.webapplication-meta.xml`);
      const config = { outputDir: 'src', routing: { trailingSlash: 'auto', fallback: 'index.html' } };
      const vfs: VirtualDirectory[] = [
        {
          dirPath: appPath,
          children: [
            `${appName}.webapplication-meta.xml`,
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
