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
import { validateUiBundleJson, isUiBundleConfig } from '../../../src/resolve/adapters/uiBundleValidation';

const CONTENT_PATH = join('force-app', 'main', 'default', 'uiBundles', 'MyApp');
const DESCRIPTOR_PATH = join(CONTENT_PATH, 'ui-bundle.json');

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
    expect((e as SfError).name).to.equal('InvalidUiBundleConfigError');
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

describe('validateUiBundleJson (direct unit tests)', () => {
  // ===== Structure & emptiness =====
  describe('structure checks', () => {
    const tree = treeWith();

    it('throws for null/empty buffer', () => {
      expectConfigError(() => validateUiBundleJson(Buffer.alloc(0), DESCRIPTOR_PATH, CONTENT_PATH, tree));
    });

    it('throws for whitespace-only content', () => {
      expectConfigError(() => validateUiBundleJson(Buffer.from('   \n  '), DESCRIPTOR_PATH, CONTENT_PATH, tree));
    });

    it('throws for invalid JSON', () => {
      expectConfigError(() => validateUiBundleJson(Buffer.from('{bad json'), DESCRIPTOR_PATH, CONTENT_PATH, tree));
    });

    it('throws when root is an array', () => {
      expectConfigError(() => validateUiBundleJson(Buffer.from('[]'), DESCRIPTOR_PATH, CONTENT_PATH, tree));
    });

    it('throws when root is a string', () => {
      expectConfigError(() => validateUiBundleJson(Buffer.from('"hello"'), DESCRIPTOR_PATH, CONTENT_PATH, tree));
    });

    it('throws when root is null', () => {
      expectConfigError(() => validateUiBundleJson(Buffer.from('null'), DESCRIPTOR_PATH, CONTENT_PATH, tree));
    });

    it('throws for empty object {}', () => {
      expectConfigError(() => validateUiBundleJson(toBuffer({}), DESCRIPTOR_PATH, CONTENT_PATH, tree));
    });

    it('throws for oversized file (>100KB)', () => {
      const huge = Buffer.alloc(102_401, 0x20);
      huge.write('{"outputDir":"dist"}');
      expectConfigError(() => validateUiBundleJson(huge, DESCRIPTOR_PATH, CONTENT_PATH, tree));
    });

    it('allows file just under 100KB', () => {
      const buf = Buffer.alloc(102_399, 0x20);
      buf.write('{"outputDir":"dist"}');
      expect(() => validateUiBundleJson(buf, DESCRIPTOR_PATH, CONTENT_PATH, tree)).to.not.throw();
    });
  });

  // ===== Unknown properties =====
  describe('unknown properties', () => {
    const tree = treeWith();

    it('throws for unknown top-level property', () => {
      expectConfigError(
        () => validateUiBundleJson(toBuffer({ apiVersion: '66.0' }), DESCRIPTOR_PATH, CONTENT_PATH, tree),
        'apiVersion'
      );
    });

    it('throws for multiple unknown properties', () => {
      expectConfigError(() => validateUiBundleJson(toBuffer({ foo: 1, bar: 2 }), DESCRIPTOR_PATH, CONTENT_PATH, tree));
    });
  });

  // ===== outputDir validation =====
  describe('outputDir', () => {
    const tree = treeWith();

    it('throws when outputDir is not a string', () => {
      expectConfigError(
        () => validateUiBundleJson(toBuffer({ outputDir: 123 }), DESCRIPTOR_PATH, CONTENT_PATH, tree),
        'string'
      );
    });

    it('throws when outputDir is empty string', () => {
      expectConfigError(() => validateUiBundleJson(toBuffer({ outputDir: '' }), DESCRIPTOR_PATH, CONTENT_PATH, tree));
    });

    it('accepts valid outputDir', () => {
      expect(() =>
        validateUiBundleJson(toBuffer({ outputDir: 'dist' }), DESCRIPTOR_PATH, CONTENT_PATH, tree)
      ).to.not.throw();
    });
  });

  // ===== Path traversal (containsPathTraversal) =====
  describe('path safety (outputDir)', () => {
    const tree = treeWith();

    it('throws for ../traversal', () => {
      expectConfigError(
        () => validateUiBundleJson(toBuffer({ outputDir: '../etc' }), DESCRIPTOR_PATH, CONTENT_PATH, tree),
        'traversal'
      );
    });

    it('throws for exactly ".."', () => {
      expectConfigError(() => validateUiBundleJson(toBuffer({ outputDir: '..' }), DESCRIPTOR_PATH, CONTENT_PATH, tree));
    });

    it('throws for nested ../segments', () => {
      expectConfigError(() =>
        validateUiBundleJson(toBuffer({ outputDir: 'a/../../b' }), DESCRIPTOR_PATH, CONTENT_PATH, tree)
      );
    });

    it('throws for trailing /..', () => {
      expectConfigError(() =>
        validateUiBundleJson(toBuffer({ outputDir: 'dist/..' }), DESCRIPTOR_PATH, CONTENT_PATH, tree)
      );
    });

    it('strips leading / from outputDir and validates the rest', () => {
      expectFileError(() =>
        validateUiBundleJson(toBuffer({ outputDir: '/etc/passwd' }), DESCRIPTOR_PATH, CONTENT_PATH, tree)
      );
    });

    it('succeeds when outputDir starts with / and directory exists', () => {
      expect(() =>
        validateUiBundleJson(toBuffer({ outputDir: '/dist' }), DESCRIPTOR_PATH, CONTENT_PATH, tree)
      ).to.not.throw();
    });

    it('throws for absolute path starting with backslash', () => {
      expectConfigError(() =>
        validateUiBundleJson(toBuffer({ outputDir: '\\Windows' }), DESCRIPTOR_PATH, CONTENT_PATH, tree)
      );
    });

    it('throws for null byte', () => {
      expectConfigError(
        () => validateUiBundleJson(toBuffer({ outputDir: 'dist\0bad' }), DESCRIPTOR_PATH, CONTENT_PATH, tree),
        'null'
      );
    });

    it('throws for tab (control character)', () => {
      expectConfigError(
        () => validateUiBundleJson(toBuffer({ outputDir: 'dist\tbad' }), DESCRIPTOR_PATH, CONTENT_PATH, tree),
        'control'
      );
    });

    it('throws for newline (control character)', () => {
      expectConfigError(() =>
        validateUiBundleJson(toBuffer({ outputDir: 'dist\nbad' }), DESCRIPTOR_PATH, CONTENT_PATH, tree)
      );
    });

    it('throws for * wildcard', () => {
      expectConfigError(
        () => validateUiBundleJson(toBuffer({ outputDir: 'dist/*' }), DESCRIPTOR_PATH, CONTENT_PATH, tree),
        'glob'
      );
    });

    it('throws for ? wildcard', () => {
      expectConfigError(() =>
        validateUiBundleJson(toBuffer({ outputDir: 'dist/?.js' }), DESCRIPTOR_PATH, CONTENT_PATH, tree)
      );
    });

    it('throws for ** glob', () => {
      expectConfigError(() =>
        validateUiBundleJson(toBuffer({ outputDir: 'dist/**' }), DESCRIPTOR_PATH, CONTENT_PATH, tree)
      );
    });

    it('throws for backslash in middle', () => {
      expectConfigError(
        () => validateUiBundleJson(toBuffer({ outputDir: 'dist\\sub' }), DESCRIPTOR_PATH, CONTENT_PATH, tree),
        'backslash'
      );
    });

    it('throws for percent-encoding', () => {
      expectConfigError(
        () => validateUiBundleJson(toBuffer({ outputDir: 'dist%2F..%2F' }), DESCRIPTOR_PATH, CONTENT_PATH, tree),
        'percent'
      );
    });
  });

  // ===== Routing validation =====
  describe('routing', () => {
    const tree = treeWith();

    it('throws when routing is not an object', () => {
      expectConfigError(() =>
        validateUiBundleJson(toBuffer({ routing: 'invalid' }), DESCRIPTOR_PATH, CONTENT_PATH, tree)
      );
    });

    it('throws when routing is an array', () => {
      expectConfigError(() => validateUiBundleJson(toBuffer({ routing: [] }), DESCRIPTOR_PATH, CONTENT_PATH, tree));
    });

    it('throws when routing is null', () => {
      expectConfigError(() => validateUiBundleJson(toBuffer({ routing: null }), DESCRIPTOR_PATH, CONTENT_PATH, tree));
    });

    it('throws for empty routing object', () => {
      expectConfigError(() => validateUiBundleJson(toBuffer({ routing: {} }), DESCRIPTOR_PATH, CONTENT_PATH, tree));
    });

    it('throws for unknown routing property', () => {
      expectConfigError(() =>
        validateUiBundleJson(toBuffer({ routing: { unknown: true } }), DESCRIPTOR_PATH, CONTENT_PATH, tree)
      );
    });

    it('accepts valid trailingSlash values', () => {
      for (const v of ['always', 'never', 'auto']) {
        expect(() =>
          validateUiBundleJson(toBuffer({ routing: { trailingSlash: v } }), DESCRIPTOR_PATH, CONTENT_PATH, tree)
        ).to.not.throw();
      }
    });

    it('throws for invalid trailingSlash value', () => {
      expectConfigError(() =>
        validateUiBundleJson(toBuffer({ routing: { trailingSlash: 'yes' } }), DESCRIPTOR_PATH, CONTENT_PATH, tree)
      );
    });

    it('throws when trailingSlash is not a string', () => {
      expectConfigError(() =>
        validateUiBundleJson(toBuffer({ routing: { trailingSlash: true } }), DESCRIPTOR_PATH, CONTENT_PATH, tree)
      );
    });

    it('throws when fileBasedRouting is not a boolean', () => {
      expectConfigError(() =>
        validateUiBundleJson(toBuffer({ routing: { fileBasedRouting: 'true' } }), DESCRIPTOR_PATH, CONTENT_PATH, tree)
      );
    });

    it('accepts fileBasedRouting as boolean', () => {
      expect(() =>
        validateUiBundleJson(toBuffer({ routing: { fileBasedRouting: true } }), DESCRIPTOR_PATH, CONTENT_PATH, tree)
      ).to.not.throw();
    });
  });

  // ===== Fallback validation =====
  describe('routing.fallback', () => {
    const tree = treeWith();

    it('throws when fallback is not a string', () => {
      expectConfigError(() =>
        validateUiBundleJson(toBuffer({ routing: { fallback: 123 } }), DESCRIPTOR_PATH, CONTENT_PATH, tree)
      );
    });

    it('throws for empty fallback string', () => {
      expectConfigError(() =>
        validateUiBundleJson(toBuffer({ routing: { fallback: '' } }), DESCRIPTOR_PATH, CONTENT_PATH, tree)
      );
    });

    it('throws for fallback with path traversal', () => {
      expectConfigError(() =>
        validateUiBundleJson(toBuffer({ routing: { fallback: '../secret.html' } }), DESCRIPTOR_PATH, CONTENT_PATH, tree)
      );
    });

    it('throws for fallback with current directory (.)', () => {
      expectConfigError(
        () => validateUiBundleJson(toBuffer({ routing: { fallback: '.' } }), DESCRIPTOR_PATH, CONTENT_PATH, tree),
        'current directory'
      );
    });

    it('throws for fallback with current directory (./)', () => {
      expectConfigError(
        () => validateUiBundleJson(toBuffer({ routing: { fallback: './' } }), DESCRIPTOR_PATH, CONTENT_PATH, tree),
        'current directory'
      );
    });
  });

  // ===== Rewrites validation =====
  describe('routing.rewrites', () => {
    const tree = treeWith();

    it('throws when rewrites is not an array', () => {
      expectConfigError(() =>
        validateUiBundleJson(toBuffer({ routing: { rewrites: 'bad' } }), DESCRIPTOR_PATH, CONTENT_PATH, tree)
      );
    });

    it('throws for empty rewrites array', () => {
      expectConfigError(() =>
        validateUiBundleJson(toBuffer({ routing: { rewrites: [] } }), DESCRIPTOR_PATH, CONTENT_PATH, tree)
      );
    });

    it('throws when rewrite item is not an object', () => {
      expectConfigError(() =>
        validateUiBundleJson(toBuffer({ routing: { rewrites: ['bad'] } }), DESCRIPTOR_PATH, CONTENT_PATH, tree)
      );
    });

    it('throws for empty rewrite item', () => {
      expectConfigError(() =>
        validateUiBundleJson(toBuffer({ routing: { rewrites: [{}] } }), DESCRIPTOR_PATH, CONTENT_PATH, tree)
      );
    });

    it('throws for unknown rewrite property', () => {
      expectConfigError(() =>
        validateUiBundleJson(
          toBuffer({ routing: { rewrites: [{ route: '/a', bad: true }] } }),
          DESCRIPTOR_PATH,
          CONTENT_PATH,
          tree
        )
      );
    });

    it('throws for empty route string', () => {
      expectConfigError(() =>
        validateUiBundleJson(toBuffer({ routing: { rewrites: [{ route: '' }] } }), DESCRIPTOR_PATH, CONTENT_PATH, tree)
      );
    });

    it('throws for non-string route', () => {
      expectConfigError(() =>
        validateUiBundleJson(toBuffer({ routing: { rewrites: [{ route: 123 }] } }), DESCRIPTOR_PATH, CONTENT_PATH, tree)
      );
    });

    it('throws for empty rewrite target', () => {
      expectConfigError(() =>
        validateUiBundleJson(
          toBuffer({ routing: { rewrites: [{ rewrite: '' }] } }),
          DESCRIPTOR_PATH,
          CONTENT_PATH,
          tree
        )
      );
    });

    it('throws for non-string rewrite target', () => {
      expectConfigError(() =>
        validateUiBundleJson(
          toBuffer({ routing: { rewrites: [{ rewrite: 42 }] } }),
          DESCRIPTOR_PATH,
          CONTENT_PATH,
          tree
        )
      );
    });

    it('throws for rewrite target with path traversal', () => {
      expectConfigError(() =>
        validateUiBundleJson(
          toBuffer({ routing: { rewrites: [{ rewrite: '../etc/passwd' }] } }),
          DESCRIPTOR_PATH,
          CONTENT_PATH,
          tree
        )
      );
    });

    it('throws for rewrite target that is just /', () => {
      expectConfigError(() =>
        validateUiBundleJson(
          toBuffer({ routing: { rewrites: [{ rewrite: '/' }] } }),
          DESCRIPTOR_PATH,
          CONTENT_PATH,
          tree
        )
      );
    });

    it('accepts valid rewrite with route only', () => {
      expect(() =>
        validateUiBundleJson(
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
        validateUiBundleJson(toBuffer({ routing: { redirects: {} } }), DESCRIPTOR_PATH, CONTENT_PATH, tree)
      );
    });

    it('throws for empty redirects array', () => {
      expectConfigError(() =>
        validateUiBundleJson(toBuffer({ routing: { redirects: [] } }), DESCRIPTOR_PATH, CONTENT_PATH, tree)
      );
    });

    it('throws when redirect item is not an object', () => {
      expectConfigError(() =>
        validateUiBundleJson(toBuffer({ routing: { redirects: [null] } }), DESCRIPTOR_PATH, CONTENT_PATH, tree)
      );
    });

    it('throws for empty redirect item', () => {
      expectConfigError(() =>
        validateUiBundleJson(toBuffer({ routing: { redirects: [{}] } }), DESCRIPTOR_PATH, CONTENT_PATH, tree)
      );
    });

    it('throws for unknown redirect property', () => {
      expectConfigError(() =>
        validateUiBundleJson(
          toBuffer({ routing: { redirects: [{ route: '/a', unknown: true }] } }),
          DESCRIPTOR_PATH,
          CONTENT_PATH,
          tree
        )
      );
    });

    it('throws for empty redirect route string', () => {
      expectConfigError(() =>
        validateUiBundleJson(toBuffer({ routing: { redirects: [{ route: '' }] } }), DESCRIPTOR_PATH, CONTENT_PATH, tree)
      );
    });

    it('throws for non-string redirect route', () => {
      expectConfigError(() =>
        validateUiBundleJson(toBuffer({ routing: { redirects: [{ route: 42 }] } }), DESCRIPTOR_PATH, CONTENT_PATH, tree)
      );
    });

    it('throws for empty redirect target', () => {
      expectConfigError(() =>
        validateUiBundleJson(
          toBuffer({ routing: { redirects: [{ redirect: '' }] } }),
          DESCRIPTOR_PATH,
          CONTENT_PATH,
          tree
        )
      );
    });

    it('throws for non-string redirect target', () => {
      expectConfigError(() =>
        validateUiBundleJson(
          toBuffer({ routing: { redirects: [{ redirect: true }] } }),
          DESCRIPTOR_PATH,
          CONTENT_PATH,
          tree
        )
      );
    });

    it('throws for invalid statusCode (not in allowed set)', () => {
      expectConfigError(() =>
        validateUiBundleJson(
          toBuffer({ routing: { redirects: [{ redirect: '/new', statusCode: 200 }] } }),
          DESCRIPTOR_PATH,
          CONTENT_PATH,
          tree
        )
      );
    });

    it('throws for non-integer statusCode', () => {
      expectConfigError(() =>
        validateUiBundleJson(
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
          validateUiBundleJson(
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
      expectConfigError(() => validateUiBundleJson(toBuffer({ headers: 'bad' }), DESCRIPTOR_PATH, CONTENT_PATH, tree));
    });

    it('throws for empty headers array', () => {
      expectConfigError(() => validateUiBundleJson(toBuffer({ headers: [] }), DESCRIPTOR_PATH, CONTENT_PATH, tree));
    });

    it('throws when header item is not an object', () => {
      expectConfigError(() => validateUiBundleJson(toBuffer({ headers: [42] }), DESCRIPTOR_PATH, CONTENT_PATH, tree));
    });

    it('throws when header item is null', () => {
      expectConfigError(() => validateUiBundleJson(toBuffer({ headers: [null] }), DESCRIPTOR_PATH, CONTENT_PATH, tree));
    });

    it('throws for empty header item', () => {
      expectConfigError(() => validateUiBundleJson(toBuffer({ headers: [{}] }), DESCRIPTOR_PATH, CONTENT_PATH, tree));
    });

    it('throws for unknown header property', () => {
      expectConfigError(() =>
        validateUiBundleJson(toBuffer({ headers: [{ source: '/**', bad: true }] }), DESCRIPTOR_PATH, CONTENT_PATH, tree)
      );
    });

    it('throws for empty source string', () => {
      expectConfigError(() =>
        validateUiBundleJson(toBuffer({ headers: [{ source: '' }] }), DESCRIPTOR_PATH, CONTENT_PATH, tree)
      );
    });

    it('throws for non-string source', () => {
      expectConfigError(() =>
        validateUiBundleJson(toBuffer({ headers: [{ source: 123 }] }), DESCRIPTOR_PATH, CONTENT_PATH, tree)
      );
    });

    it('throws when nested headers is not an array', () => {
      expectConfigError(() =>
        validateUiBundleJson(
          toBuffer({ headers: [{ source: '/**', headers: 'bad' }] }),
          DESCRIPTOR_PATH,
          CONTENT_PATH,
          tree
        )
      );
    });

    it('throws for empty nested headers array', () => {
      expectConfigError(() =>
        validateUiBundleJson(
          toBuffer({ headers: [{ source: '/**', headers: [] }] }),
          DESCRIPTOR_PATH,
          CONTENT_PATH,
          tree
        )
      );
    });

    it('throws when key-value item is not an object', () => {
      expectConfigError(() =>
        validateUiBundleJson(
          toBuffer({ headers: [{ source: '/**', headers: ['bad'] }] }),
          DESCRIPTOR_PATH,
          CONTENT_PATH,
          tree
        )
      );
    });

    it('throws for empty key-value item', () => {
      expectConfigError(() =>
        validateUiBundleJson(
          toBuffer({ headers: [{ source: '/**', headers: [{}] }] }),
          DESCRIPTOR_PATH,
          CONTENT_PATH,
          tree
        )
      );
    });

    it('throws for unknown key-value property', () => {
      expectConfigError(() =>
        validateUiBundleJson(
          toBuffer({ headers: [{ source: '/**', headers: [{ key: 'X-Frame', value: 'DENY', extra: true }] }] }),
          DESCRIPTOR_PATH,
          CONTENT_PATH,
          tree
        )
      );
    });

    it('throws for empty key string', () => {
      expectConfigError(() =>
        validateUiBundleJson(
          toBuffer({ headers: [{ source: '/**', headers: [{ key: '' }] }] }),
          DESCRIPTOR_PATH,
          CONTENT_PATH,
          tree
        )
      );
    });

    it('throws for non-string key', () => {
      expectConfigError(() =>
        validateUiBundleJson(
          toBuffer({ headers: [{ source: '/**', headers: [{ key: 42 }] }] }),
          DESCRIPTOR_PATH,
          CONTENT_PATH,
          tree
        )
      );
    });

    it('throws for empty value string', () => {
      expectConfigError(() =>
        validateUiBundleJson(
          toBuffer({ headers: [{ source: '/**', headers: [{ value: '' }] }] }),
          DESCRIPTOR_PATH,
          CONTENT_PATH,
          tree
        )
      );
    });

    it('throws for non-string value', () => {
      expectConfigError(() =>
        validateUiBundleJson(
          toBuffer({ headers: [{ source: '/**', headers: [{ value: true }] }] }),
          DESCRIPTOR_PATH,
          CONTENT_PATH,
          tree
        )
      );
    });

    it('accepts valid headers', () => {
      expect(() =>
        validateUiBundleJson(
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
      expectFileError(() => validateUiBundleJson(toBuffer({ outputDir: 'dist' }), DESCRIPTOR_PATH, CONTENT_PATH, tree));
    });

    it('throws when outputDir resolves to bundle root (.)', () => {
      const tree = treeWith();
      expectConfigError(() => validateUiBundleJson(toBuffer({ outputDir: '.' }), DESCRIPTOR_PATH, CONTENT_PATH, tree));
    });

    it('throws when outputDir resolves to bundle root (./)', () => {
      const tree = treeWith();
      expectConfigError(() => validateUiBundleJson(toBuffer({ outputDir: './' }), DESCRIPTOR_PATH, CONTENT_PATH, tree));
    });

    it('throws when fallback file does not exist', () => {
      const tree = treeWith();
      expectFileError(() =>
        validateUiBundleJson(
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
        validateUiBundleJson(
          toBuffer({ outputDir: 'dist', routing: { fallback: '404.html' } }),
          DESCRIPTOR_PATH,
          CONTENT_PATH,
          tree
        )
      ).to.not.throw();
    });

    it('succeeds when fallback starts with / and file exists', () => {
      const tree = treeWith();
      expect(() =>
        validateUiBundleJson(
          toBuffer({ outputDir: 'dist', routing: { fallback: '/index.html' } }),
          DESCRIPTOR_PATH,
          CONTENT_PATH,
          tree
        )
      ).to.not.throw();
    });

    it('throws when rewrite target does not exist', () => {
      const tree = treeWith();
      expectFileError(() =>
        validateUiBundleJson(
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
        validateUiBundleJson(
          toBuffer({ outputDir: 'dist', routing: { rewrites: [{ route: '/api/*', rewrite: 'app.html' }] } }),
          DESCRIPTOR_PATH,
          CONTENT_PATH,
          tree
        )
      ).to.not.throw();
    });

    it('succeeds when rewrite target starts with / and file exists', () => {
      const tree = treeWith({ [join(CONTENT_PATH, 'dist', 'app.html')]: '' });
      expect(() =>
        validateUiBundleJson(
          toBuffer({ outputDir: 'dist', routing: { rewrites: [{ route: '/api/*', rewrite: '/app.html' }] } }),
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
        validateUiBundleJson(toBuffer({ outputDir: 'dist' }), DESCRIPTOR_PATH, CONTENT_PATH, tree)
      ).to.not.throw();
    });
  });

  // ===== isUiBundleConfig =====
  describe('isUiBundleConfig', () => {
    it('returns true for plain object', () => {
      expect(isUiBundleConfig({ outputDir: 'dist' })).to.be.true;
    });
    it('returns true for empty object', () => {
      expect(isUiBundleConfig({})).to.be.true;
    });
    it('returns false for null', () => {
      expect(isUiBundleConfig(null)).to.be.false;
    });
    it('returns false for array', () => {
      expect(isUiBundleConfig([])).to.be.false;
    });
    it('returns false for string', () => {
      expect(isUiBundleConfig('hello')).to.be.false;
    });
    it('returns false for number', () => {
      expect(isUiBundleConfig(42)).to.be.false;
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
        validateUiBundleJson(toBuffer({ outputDir: 'dist' }), DESCRIPTOR_PATH, CONTENT_PATH, tree)
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
      expect(() => validateUiBundleJson(toBuffer(config), DESCRIPTOR_PATH, CONTENT_PATH, tree)).to.not.throw();
    });

    it('accepts routing without outputDir (fallback is not checked)', () => {
      expect(() =>
        validateUiBundleJson(toBuffer({ routing: { trailingSlash: 'never' } }), DESCRIPTOR_PATH, CONTENT_PATH, tree)
      ).to.not.throw();
    });

    it('accepts headers only', () => {
      expect(() =>
        validateUiBundleJson(
          toBuffer({ headers: [{ source: '/**', headers: [{ key: 'Cache-Control', value: 'no-cache' }] }] }),
          DESCRIPTOR_PATH,
          CONTENT_PATH,
          tree
        )
      ).to.not.throw();
    });
  });
});
