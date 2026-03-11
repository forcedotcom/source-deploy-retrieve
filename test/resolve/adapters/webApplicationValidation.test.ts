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
import { SfError } from '@salesforce/core/sfError';
import { VirtualTreeContainer } from '../../../src/resolve/treeContainers';
import {
  validateWebApplicationJson,
  isWebApplicationConfig,
} from '../../../src/resolve/adapters/webApplicationValidation';

const CONTENT_PATH = join('force-app', 'main', 'default', 'webapplications', 'MyApp');
const DESCRIPTOR_PATH = join(CONTENT_PATH, 'webapplication.json');

/** Build a tree where outputDir exists and has at least one file. */
function treeWith(extra: Record<string, string> = {}): VirtualTreeContainer {
  const paths: Array<[string, string]> = [[join(CONTENT_PATH, 'dist', 'index.html'), '<html></html>']];
  for (const [k, v] of Object.entries(extra)) {
    paths.push([k, v]);
  }
  return VirtualTreeContainer.fromFilePaths(paths.map(([p]) => p));
}

function toBuffer(obj: unknown): Buffer {
  return Buffer.from(JSON.stringify(obj));
}

function expectConfigError(fn: () => void, messageIncludes?: string): void {
  try {
    fn();
    assert.fail('expected to throw');
  } catch (e) {
    expect(e).to.be.instanceOf(SfError);
    expect((e as SfError).name).to.equal('InvalidWebApplicationConfigError');
    if (messageIncludes) {
      expect((e as SfError).message).to.include(messageIncludes);
    }
  }
}

function expectFileError(fn: () => void): void {
  try {
    fn();
    assert.fail('expected to throw');
  } catch (e) {
    expect(e).to.be.instanceOf(SfError);
    expect((e as SfError).name).to.equal('ExpectedSourceFilesError');
  }
}

describe('validateWebApplicationJson (direct unit tests)', () => {
  // ===== Structure & emptiness =====
  describe('structure checks', () => {
    const tree = treeWith();

    it('throws for null/empty buffer', () => {
      expectConfigError(() => validateWebApplicationJson(Buffer.alloc(0), DESCRIPTOR_PATH, CONTENT_PATH, tree));
    });

    it('throws for whitespace-only content', () => {
      expectConfigError(() => validateWebApplicationJson(Buffer.from('   \n  '), DESCRIPTOR_PATH, CONTENT_PATH, tree));
    });

    it('throws for invalid JSON', () => {
      expectConfigError(() =>
        validateWebApplicationJson(Buffer.from('{bad json'), DESCRIPTOR_PATH, CONTENT_PATH, tree)
      );
    });

    it('throws when root is an array', () => {
      expectConfigError(() => validateWebApplicationJson(Buffer.from('[]'), DESCRIPTOR_PATH, CONTENT_PATH, tree));
    });

    it('throws when root is a string', () => {
      expectConfigError(() => validateWebApplicationJson(Buffer.from('"hello"'), DESCRIPTOR_PATH, CONTENT_PATH, tree));
    });

    it('throws when root is null', () => {
      expectConfigError(() => validateWebApplicationJson(Buffer.from('null'), DESCRIPTOR_PATH, CONTENT_PATH, tree));
    });

    it('throws for empty object {}', () => {
      expectConfigError(() => validateWebApplicationJson(toBuffer({}), DESCRIPTOR_PATH, CONTENT_PATH, tree));
    });

    it('throws for oversized file (>100KB)', () => {
      const huge = Buffer.alloc(102_401, 0x20);
      huge.write('{"outputDir":"dist"}');
      expectConfigError(() => validateWebApplicationJson(huge, DESCRIPTOR_PATH, CONTENT_PATH, tree));
    });

    it('allows file just under 100KB', () => {
      const buf = Buffer.alloc(102_399, 0x20);
      buf.write('{"outputDir":"dist"}');
      expect(() => validateWebApplicationJson(buf, DESCRIPTOR_PATH, CONTENT_PATH, tree)).to.not.throw();
    });
  });

  // ===== Unknown properties =====
  describe('unknown properties', () => {
    const tree = treeWith();

    it('throws for unknown top-level property', () => {
      expectConfigError(
        () => validateWebApplicationJson(toBuffer({ apiVersion: '66.0' }), DESCRIPTOR_PATH, CONTENT_PATH, tree),
        'apiVersion'
      );
    });

    it('throws for multiple unknown properties', () => {
      expectConfigError(() =>
        validateWebApplicationJson(toBuffer({ foo: 1, bar: 2 }), DESCRIPTOR_PATH, CONTENT_PATH, tree)
      );
    });
  });

  // ===== outputDir validation =====
  describe('outputDir', () => {
    const tree = treeWith();

    it('throws when outputDir is not a string', () => {
      expectConfigError(
        () => validateWebApplicationJson(toBuffer({ outputDir: 123 }), DESCRIPTOR_PATH, CONTENT_PATH, tree),
        'string'
      );
    });

    it('throws when outputDir is empty string', () => {
      expectConfigError(() =>
        validateWebApplicationJson(toBuffer({ outputDir: '' }), DESCRIPTOR_PATH, CONTENT_PATH, tree)
      );
    });

    it('accepts valid outputDir', () => {
      expect(() =>
        validateWebApplicationJson(toBuffer({ outputDir: 'dist' }), DESCRIPTOR_PATH, CONTENT_PATH, tree)
      ).to.not.throw();
    });
  });

  // ===== Path traversal (containsPathTraversal) =====
  describe('path safety (outputDir)', () => {
    const tree = treeWith();

    it('throws for ../traversal', () => {
      expectConfigError(
        () => validateWebApplicationJson(toBuffer({ outputDir: '../etc' }), DESCRIPTOR_PATH, CONTENT_PATH, tree),
        'traversal'
      );
    });

    it('throws for exactly ".."', () => {
      expectConfigError(() =>
        validateWebApplicationJson(toBuffer({ outputDir: '..' }), DESCRIPTOR_PATH, CONTENT_PATH, tree)
      );
    });

    it('throws for nested ../segments', () => {
      expectConfigError(() =>
        validateWebApplicationJson(toBuffer({ outputDir: 'a/../../b' }), DESCRIPTOR_PATH, CONTENT_PATH, tree)
      );
    });

    it('throws for trailing /..', () => {
      expectConfigError(() =>
        validateWebApplicationJson(toBuffer({ outputDir: 'dist/..' }), DESCRIPTOR_PATH, CONTENT_PATH, tree)
      );
    });

    it('throws for absolute path starting with /', () => {
      expectConfigError(
        () => validateWebApplicationJson(toBuffer({ outputDir: '/etc/passwd' }), DESCRIPTOR_PATH, CONTENT_PATH, tree),
        'absolute'
      );
    });

    it('throws for absolute path starting with backslash', () => {
      expectConfigError(() =>
        validateWebApplicationJson(toBuffer({ outputDir: '\\Windows' }), DESCRIPTOR_PATH, CONTENT_PATH, tree)
      );
    });

    it('throws for null byte', () => {
      expectConfigError(
        () => validateWebApplicationJson(toBuffer({ outputDir: 'dist\0bad' }), DESCRIPTOR_PATH, CONTENT_PATH, tree),
        'null'
      );
    });

    it('throws for tab (control character)', () => {
      expectConfigError(
        () => validateWebApplicationJson(toBuffer({ outputDir: 'dist\tbad' }), DESCRIPTOR_PATH, CONTENT_PATH, tree),
        'control'
      );
    });

    it('throws for newline (control character)', () => {
      expectConfigError(() =>
        validateWebApplicationJson(toBuffer({ outputDir: 'dist\nbad' }), DESCRIPTOR_PATH, CONTENT_PATH, tree)
      );
    });

    it('throws for * wildcard', () => {
      expectConfigError(
        () => validateWebApplicationJson(toBuffer({ outputDir: 'dist/*' }), DESCRIPTOR_PATH, CONTENT_PATH, tree),
        'glob'
      );
    });

    it('throws for ? wildcard', () => {
      expectConfigError(() =>
        validateWebApplicationJson(toBuffer({ outputDir: 'dist/?.js' }), DESCRIPTOR_PATH, CONTENT_PATH, tree)
      );
    });

    it('throws for ** glob', () => {
      expectConfigError(() =>
        validateWebApplicationJson(toBuffer({ outputDir: 'dist/**' }), DESCRIPTOR_PATH, CONTENT_PATH, tree)
      );
    });

    it('throws for backslash in middle', () => {
      expectConfigError(
        () => validateWebApplicationJson(toBuffer({ outputDir: 'dist\\sub' }), DESCRIPTOR_PATH, CONTENT_PATH, tree),
        'backslash'
      );
    });

    it('throws for percent-encoding', () => {
      expectConfigError(
        () => validateWebApplicationJson(toBuffer({ outputDir: 'dist%2F..%2F' }), DESCRIPTOR_PATH, CONTENT_PATH, tree),
        'percent'
      );
    });
  });

  // ===== Routing validation =====
  describe('routing', () => {
    const tree = treeWith();

    it('throws when routing is not an object', () => {
      expectConfigError(() =>
        validateWebApplicationJson(toBuffer({ routing: 'invalid' }), DESCRIPTOR_PATH, CONTENT_PATH, tree)
      );
    });

    it('throws when routing is an array', () => {
      expectConfigError(() =>
        validateWebApplicationJson(toBuffer({ routing: [] }), DESCRIPTOR_PATH, CONTENT_PATH, tree)
      );
    });

    it('throws when routing is null', () => {
      expectConfigError(() =>
        validateWebApplicationJson(toBuffer({ routing: null }), DESCRIPTOR_PATH, CONTENT_PATH, tree)
      );
    });

    it('throws for empty routing object', () => {
      expectConfigError(() =>
        validateWebApplicationJson(toBuffer({ routing: {} }), DESCRIPTOR_PATH, CONTENT_PATH, tree)
      );
    });

    it('throws for unknown routing property', () => {
      expectConfigError(() =>
        validateWebApplicationJson(toBuffer({ routing: { unknown: true } }), DESCRIPTOR_PATH, CONTENT_PATH, tree)
      );
    });

    it('accepts valid trailingSlash values', () => {
      for (const v of ['always', 'never', 'auto']) {
        expect(() =>
          validateWebApplicationJson(toBuffer({ routing: { trailingSlash: v } }), DESCRIPTOR_PATH, CONTENT_PATH, tree)
        ).to.not.throw();
      }
    });

    it('throws for invalid trailingSlash value', () => {
      expectConfigError(() =>
        validateWebApplicationJson(toBuffer({ routing: { trailingSlash: 'yes' } }), DESCRIPTOR_PATH, CONTENT_PATH, tree)
      );
    });

    it('throws when trailingSlash is not a string', () => {
      expectConfigError(() =>
        validateWebApplicationJson(toBuffer({ routing: { trailingSlash: true } }), DESCRIPTOR_PATH, CONTENT_PATH, tree)
      );
    });

    it('throws when fileBasedRouting is not a boolean', () => {
      expectConfigError(() =>
        validateWebApplicationJson(
          toBuffer({ routing: { fileBasedRouting: 'true' } }),
          DESCRIPTOR_PATH,
          CONTENT_PATH,
          tree
        )
      );
    });

    it('accepts fileBasedRouting as boolean', () => {
      expect(() =>
        validateWebApplicationJson(
          toBuffer({ routing: { fileBasedRouting: true } }),
          DESCRIPTOR_PATH,
          CONTENT_PATH,
          tree
        )
      ).to.not.throw();
    });
  });

  // ===== Fallback validation =====
  describe('routing.fallback', () => {
    const tree = treeWith();

    it('throws when fallback is not a string', () => {
      expectConfigError(() =>
        validateWebApplicationJson(toBuffer({ routing: { fallback: 123 } }), DESCRIPTOR_PATH, CONTENT_PATH, tree)
      );
    });

    it('throws for empty fallback string', () => {
      expectConfigError(() =>
        validateWebApplicationJson(toBuffer({ routing: { fallback: '' } }), DESCRIPTOR_PATH, CONTENT_PATH, tree)
      );
    });

    it('throws for fallback with path traversal', () => {
      expectConfigError(() =>
        validateWebApplicationJson(
          toBuffer({ routing: { fallback: '../secret.html' } }),
          DESCRIPTOR_PATH,
          CONTENT_PATH,
          tree
        )
      );
    });
  });

  // ===== Rewrites validation =====
  describe('routing.rewrites', () => {
    const tree = treeWith();

    it('throws when rewrites is not an array', () => {
      expectConfigError(() =>
        validateWebApplicationJson(toBuffer({ routing: { rewrites: 'bad' } }), DESCRIPTOR_PATH, CONTENT_PATH, tree)
      );
    });

    it('throws for empty rewrites array', () => {
      expectConfigError(() =>
        validateWebApplicationJson(toBuffer({ routing: { rewrites: [] } }), DESCRIPTOR_PATH, CONTENT_PATH, tree)
      );
    });

    it('throws when rewrite item is not an object', () => {
      expectConfigError(() =>
        validateWebApplicationJson(toBuffer({ routing: { rewrites: ['bad'] } }), DESCRIPTOR_PATH, CONTENT_PATH, tree)
      );
    });

    it('throws for empty rewrite item', () => {
      expectConfigError(() =>
        validateWebApplicationJson(toBuffer({ routing: { rewrites: [{}] } }), DESCRIPTOR_PATH, CONTENT_PATH, tree)
      );
    });

    it('throws for unknown rewrite property', () => {
      expectConfigError(() =>
        validateWebApplicationJson(
          toBuffer({ routing: { rewrites: [{ route: '/a', bad: true }] } }),
          DESCRIPTOR_PATH,
          CONTENT_PATH,
          tree
        )
      );
    });

    it('throws for empty route string', () => {
      expectConfigError(() =>
        validateWebApplicationJson(
          toBuffer({ routing: { rewrites: [{ route: '' }] } }),
          DESCRIPTOR_PATH,
          CONTENT_PATH,
          tree
        )
      );
    });

    it('throws for non-string route', () => {
      expectConfigError(() =>
        validateWebApplicationJson(
          toBuffer({ routing: { rewrites: [{ route: 123 }] } }),
          DESCRIPTOR_PATH,
          CONTENT_PATH,
          tree
        )
      );
    });

    it('throws for empty rewrite target', () => {
      expectConfigError(() =>
        validateWebApplicationJson(
          toBuffer({ routing: { rewrites: [{ rewrite: '' }] } }),
          DESCRIPTOR_PATH,
          CONTENT_PATH,
          tree
        )
      );
    });

    it('throws for non-string rewrite target', () => {
      expectConfigError(() =>
        validateWebApplicationJson(
          toBuffer({ routing: { rewrites: [{ rewrite: 42 }] } }),
          DESCRIPTOR_PATH,
          CONTENT_PATH,
          tree
        )
      );
    });

    it('throws for rewrite target with path traversal', () => {
      expectConfigError(() =>
        validateWebApplicationJson(
          toBuffer({ routing: { rewrites: [{ rewrite: '../etc/passwd' }] } }),
          DESCRIPTOR_PATH,
          CONTENT_PATH,
          tree
        )
      );
    });

    it('accepts valid rewrite with route only', () => {
      expect(() =>
        validateWebApplicationJson(
          toBuffer({ routing: { rewrites: [{ route: '/api/*' }] } }),
          DESCRIPTOR_PATH,
          CONTENT_PATH,
          tree
        )
      ).to.not.throw();
    });
  });

  // ===== Redirects validation =====
  describe('routing.redirects', () => {
    const tree = treeWith();

    it('throws when redirects is not an array', () => {
      expectConfigError(() =>
        validateWebApplicationJson(toBuffer({ routing: { redirects: {} } }), DESCRIPTOR_PATH, CONTENT_PATH, tree)
      );
    });

    it('throws for empty redirects array', () => {
      expectConfigError(() =>
        validateWebApplicationJson(toBuffer({ routing: { redirects: [] } }), DESCRIPTOR_PATH, CONTENT_PATH, tree)
      );
    });

    it('throws when redirect item is not an object', () => {
      expectConfigError(() =>
        validateWebApplicationJson(toBuffer({ routing: { redirects: [null] } }), DESCRIPTOR_PATH, CONTENT_PATH, tree)
      );
    });

    it('throws for empty redirect item', () => {
      expectConfigError(() =>
        validateWebApplicationJson(toBuffer({ routing: { redirects: [{}] } }), DESCRIPTOR_PATH, CONTENT_PATH, tree)
      );
    });

    it('throws for unknown redirect property', () => {
      expectConfigError(() =>
        validateWebApplicationJson(
          toBuffer({ routing: { redirects: [{ route: '/a', unknown: true }] } }),
          DESCRIPTOR_PATH,
          CONTENT_PATH,
          tree
        )
      );
    });

    it('throws for empty redirect route string', () => {
      expectConfigError(() =>
        validateWebApplicationJson(
          toBuffer({ routing: { redirects: [{ route: '' }] } }),
          DESCRIPTOR_PATH,
          CONTENT_PATH,
          tree
        )
      );
    });

    it('throws for non-string redirect route', () => {
      expectConfigError(() =>
        validateWebApplicationJson(
          toBuffer({ routing: { redirects: [{ route: 42 }] } }),
          DESCRIPTOR_PATH,
          CONTENT_PATH,
          tree
        )
      );
    });

    it('throws for empty redirect target', () => {
      expectConfigError(() =>
        validateWebApplicationJson(
          toBuffer({ routing: { redirects: [{ redirect: '' }] } }),
          DESCRIPTOR_PATH,
          CONTENT_PATH,
          tree
        )
      );
    });

    it('throws for non-string redirect target', () => {
      expectConfigError(() =>
        validateWebApplicationJson(
          toBuffer({ routing: { redirects: [{ redirect: true }] } }),
          DESCRIPTOR_PATH,
          CONTENT_PATH,
          tree
        )
      );
    });

    it('throws for invalid statusCode (not in allowed set)', () => {
      expectConfigError(() =>
        validateWebApplicationJson(
          toBuffer({ routing: { redirects: [{ redirect: '/new', statusCode: 200 }] } }),
          DESCRIPTOR_PATH,
          CONTENT_PATH,
          tree
        )
      );
    });

    it('throws for non-integer statusCode', () => {
      expectConfigError(() =>
        validateWebApplicationJson(
          toBuffer({ routing: { redirects: [{ redirect: '/new', statusCode: 'abc' }] } }),
          DESCRIPTOR_PATH,
          CONTENT_PATH,
          tree
        )
      );
    });

    it('accepts valid redirect with statusCode', () => {
      for (const code of [301, 302, 307, 308]) {
        expect(() =>
          validateWebApplicationJson(
            toBuffer({ routing: { redirects: [{ route: '/old', redirect: '/new', statusCode: code }] } }),
            DESCRIPTOR_PATH,
            CONTENT_PATH,
            tree
          )
        ).to.not.throw();
      }
    });
  });

  // ===== Headers validation =====
  describe('headers', () => {
    const tree = treeWith();

    it('throws when headers is not an array', () => {
      expectConfigError(() =>
        validateWebApplicationJson(toBuffer({ headers: 'bad' }), DESCRIPTOR_PATH, CONTENT_PATH, tree)
      );
    });

    it('throws for empty headers array', () => {
      expectConfigError(() =>
        validateWebApplicationJson(toBuffer({ headers: [] }), DESCRIPTOR_PATH, CONTENT_PATH, tree)
      );
    });

    it('throws when header item is not an object', () => {
      expectConfigError(() =>
        validateWebApplicationJson(toBuffer({ headers: [42] }), DESCRIPTOR_PATH, CONTENT_PATH, tree)
      );
    });

    it('throws when header item is null', () => {
      expectConfigError(() =>
        validateWebApplicationJson(toBuffer({ headers: [null] }), DESCRIPTOR_PATH, CONTENT_PATH, tree)
      );
    });

    it('throws for empty header item', () => {
      expectConfigError(() =>
        validateWebApplicationJson(toBuffer({ headers: [{}] }), DESCRIPTOR_PATH, CONTENT_PATH, tree)
      );
    });

    it('throws for unknown header property', () => {
      expectConfigError(() =>
        validateWebApplicationJson(
          toBuffer({ headers: [{ source: '/**', bad: true }] }),
          DESCRIPTOR_PATH,
          CONTENT_PATH,
          tree
        )
      );
    });

    it('throws for empty source string', () => {
      expectConfigError(() =>
        validateWebApplicationJson(toBuffer({ headers: [{ source: '' }] }), DESCRIPTOR_PATH, CONTENT_PATH, tree)
      );
    });

    it('throws for non-string source', () => {
      expectConfigError(() =>
        validateWebApplicationJson(toBuffer({ headers: [{ source: 123 }] }), DESCRIPTOR_PATH, CONTENT_PATH, tree)
      );
    });

    it('throws when nested headers is not an array', () => {
      expectConfigError(() =>
        validateWebApplicationJson(
          toBuffer({ headers: [{ source: '/**', headers: 'bad' }] }),
          DESCRIPTOR_PATH,
          CONTENT_PATH,
          tree
        )
      );
    });

    it('throws for empty nested headers array', () => {
      expectConfigError(() =>
        validateWebApplicationJson(
          toBuffer({ headers: [{ source: '/**', headers: [] }] }),
          DESCRIPTOR_PATH,
          CONTENT_PATH,
          tree
        )
      );
    });

    it('throws when key-value item is not an object', () => {
      expectConfigError(() =>
        validateWebApplicationJson(
          toBuffer({ headers: [{ source: '/**', headers: ['bad'] }] }),
          DESCRIPTOR_PATH,
          CONTENT_PATH,
          tree
        )
      );
    });

    it('throws for empty key-value item', () => {
      expectConfigError(() =>
        validateWebApplicationJson(
          toBuffer({ headers: [{ source: '/**', headers: [{}] }] }),
          DESCRIPTOR_PATH,
          CONTENT_PATH,
          tree
        )
      );
    });

    it('throws for unknown key-value property', () => {
      expectConfigError(() =>
        validateWebApplicationJson(
          toBuffer({ headers: [{ source: '/**', headers: [{ key: 'X-Frame', value: 'DENY', extra: true }] }] }),
          DESCRIPTOR_PATH,
          CONTENT_PATH,
          tree
        )
      );
    });

    it('throws for empty key string', () => {
      expectConfigError(() =>
        validateWebApplicationJson(
          toBuffer({ headers: [{ source: '/**', headers: [{ key: '' }] }] }),
          DESCRIPTOR_PATH,
          CONTENT_PATH,
          tree
        )
      );
    });

    it('throws for non-string key', () => {
      expectConfigError(() =>
        validateWebApplicationJson(
          toBuffer({ headers: [{ source: '/**', headers: [{ key: 42 }] }] }),
          DESCRIPTOR_PATH,
          CONTENT_PATH,
          tree
        )
      );
    });

    it('throws for empty value string', () => {
      expectConfigError(() =>
        validateWebApplicationJson(
          toBuffer({ headers: [{ source: '/**', headers: [{ value: '' }] }] }),
          DESCRIPTOR_PATH,
          CONTENT_PATH,
          tree
        )
      );
    });

    it('throws for non-string value', () => {
      expectConfigError(() =>
        validateWebApplicationJson(
          toBuffer({ headers: [{ source: '/**', headers: [{ value: true }] }] }),
          DESCRIPTOR_PATH,
          CONTENT_PATH,
          tree
        )
      );
    });

    it('accepts valid headers', () => {
      expect(() =>
        validateWebApplicationJson(
          toBuffer({ headers: [{ source: '/**', headers: [{ key: 'X-Frame-Options', value: 'DENY' }] }] }),
          DESCRIPTOR_PATH,
          CONTENT_PATH,
          tree
        )
      ).to.not.throw();
    });
  });

  // ===== File existence checks =====
  describe('file existence (outputDir, fallback, rewrite targets)', () => {
    it('throws when outputDir directory does not exist', () => {
      const tree = VirtualTreeContainer.fromFilePaths([join(CONTENT_PATH, 'other', 'index.html')]);
      expectFileError(() =>
        validateWebApplicationJson(toBuffer({ outputDir: 'dist' }), DESCRIPTOR_PATH, CONTENT_PATH, tree)
      );
    });

    it('throws when outputDir resolves to bundle root (.)', () => {
      const tree = treeWith();
      expectConfigError(() =>
        validateWebApplicationJson(toBuffer({ outputDir: '.' }), DESCRIPTOR_PATH, CONTENT_PATH, tree)
      );
    });

    it('throws when outputDir resolves to bundle root (./)', () => {
      const tree = treeWith();
      expectConfigError(() =>
        validateWebApplicationJson(toBuffer({ outputDir: './' }), DESCRIPTOR_PATH, CONTENT_PATH, tree)
      );
    });

    it('throws when fallback file does not exist', () => {
      const tree = treeWith();
      expectFileError(() =>
        validateWebApplicationJson(
          toBuffer({ outputDir: 'dist', routing: { fallback: 'missing.html' } }),
          DESCRIPTOR_PATH,
          CONTENT_PATH,
          tree
        )
      );
    });

    it('succeeds when fallback file exists', () => {
      const tree = treeWith({ [join(CONTENT_PATH, 'dist', '404.html')]: '' });
      expect(() =>
        validateWebApplicationJson(
          toBuffer({ outputDir: 'dist', routing: { fallback: '404.html' } }),
          DESCRIPTOR_PATH,
          CONTENT_PATH,
          tree
        )
      ).to.not.throw();
    });

    it('throws when rewrite target does not exist', () => {
      const tree = treeWith();
      expectFileError(() =>
        validateWebApplicationJson(
          toBuffer({ outputDir: 'dist', routing: { rewrites: [{ route: '/api/*', rewrite: 'missing.html' }] } }),
          DESCRIPTOR_PATH,
          CONTENT_PATH,
          tree
        )
      );
    });

    it('succeeds when rewrite target exists', () => {
      const tree = treeWith({ [join(CONTENT_PATH, 'dist', 'app.html')]: '' });
      expect(() =>
        validateWebApplicationJson(
          toBuffer({ outputDir: 'dist', routing: { rewrites: [{ route: '/api/*', rewrite: 'app.html' }] } }),
          DESCRIPTOR_PATH,
          CONTENT_PATH,
          tree
        )
      ).to.not.throw();
    });

    it('succeeds with outputDir that has nested files', () => {
      const tree = treeWith({
        [join(CONTENT_PATH, 'dist', 'sub', 'nested.html')]: '<html></html>',
      });
      expect(() =>
        validateWebApplicationJson(toBuffer({ outputDir: 'dist' }), DESCRIPTOR_PATH, CONTENT_PATH, tree)
      ).to.not.throw();
    });
  });

  // ===== isWebApplicationConfig =====
  describe('isWebApplicationConfig', () => {
    it('returns true for plain object', () => {
      expect(isWebApplicationConfig({ outputDir: 'dist' })).to.be.true;
    });
    it('returns true for empty object', () => {
      expect(isWebApplicationConfig({})).to.be.true;
    });
    it('returns false for null', () => {
      expect(isWebApplicationConfig(null)).to.be.false;
    });
    it('returns false for array', () => {
      expect(isWebApplicationConfig([])).to.be.false;
    });
    it('returns false for string', () => {
      expect(isWebApplicationConfig('hello')).to.be.false;
    });
    it('returns false for number', () => {
      expect(isWebApplicationConfig(42)).to.be.false;
    });
  });

  // ===== Valid full configs =====
  describe('valid complete configurations', () => {
    const tree = treeWith({
      [join(CONTENT_PATH, 'dist', '404.html')]: '',
      [join(CONTENT_PATH, 'dist', 'app.html')]: '',
    });

    it('accepts outputDir only', () => {
      expect(() =>
        validateWebApplicationJson(toBuffer({ outputDir: 'dist' }), DESCRIPTOR_PATH, CONTENT_PATH, tree)
      ).to.not.throw();
    });

    it('accepts full config with routing, headers, and outputDir', () => {
      const config = {
        outputDir: 'dist',
        routing: {
          trailingSlash: 'auto',
          fileBasedRouting: false,
          fallback: '404.html',
          rewrites: [{ route: '/api/*', rewrite: 'app.html' }],
          redirects: [{ route: '/old', redirect: '/new', statusCode: 301 }],
        },
        headers: [{ source: '/**', headers: [{ key: 'X-Frame-Options', value: 'DENY' }] }],
      };
      expect(() => validateWebApplicationJson(toBuffer(config), DESCRIPTOR_PATH, CONTENT_PATH, tree)).to.not.throw();
    });

    it('accepts routing without outputDir (fallback is not checked)', () => {
      expect(() =>
        validateWebApplicationJson(
          toBuffer({ routing: { trailingSlash: 'never' } }),
          DESCRIPTOR_PATH,
          CONTENT_PATH,
          tree
        )
      ).to.not.throw();
    });

    it('accepts headers only', () => {
      expect(() =>
        validateWebApplicationJson(
          toBuffer({ headers: [{ source: '/**', headers: [{ key: 'Cache-Control', value: 'no-cache' }] }] }),
          DESCRIPTOR_PATH,
          CONTENT_PATH,
          tree
        )
      ).to.not.throw();
    });
  });
});
