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
import { join, resolve, sep } from 'node:path';
import { Messages } from '@salesforce/core/messages';
import { SfError } from '@salesforce/core/sfError';
import type { TreeContainer } from '../treeContainers';
import { SourcePath } from '../../common/types';
import { SourceComponent } from '../sourceComponent';
import { baseName } from '../../utils/path';
import { BundleSourceAdapter } from './bundleSourceAdapter';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/source-deploy-retrieve', 'sdr');

// webapplication.json schema constraints — keep in sync with the server-side validation
// (WebApplicationFileProcessor.java).
const ALLOWED_TOP_LEVEL = new Set(['apiVersion', 'outputDir', 'routing', 'headers']);
const ROUTING_ALLOWED = new Set(['rewrites', 'redirects', 'fallback', 'trailingSlash', 'fileBasedRouting']);
const TRAILING_SLASH_VALUES = new Set(['always', 'never', 'auto']);
const REDIRECT_STATUS_CODES = new Set([301, 302, 307, 308]);
const API_VERSION_REGEX = /^\d+\.0$/;
const MAX_RECURSION_DEPTH = 20;
const MAX_WEBAPPLICATION_JSON_BYTES = 102_400; // 100 KB — matches server-side limit

// ".." as a standalone path segment: start-or-sep, "..", sep-or-end
const DOT_DOT_SEGMENT = /(?:^|[/\\])\.\.[/\\]|(?:^|[/\\])\.\.$/;

/** Strip leading path separators so paths like "/index.html" resolve relative to outputDir. */
function stripLeadingSep(p: string): string {
  return p.replace(new RegExp(`^[${sep.replace(/\\/g, '\\\\')}/]+`), '');
}

/**
 * Detect dangerous characters or patterns in a user-supplied path value.
 *
 * Mirrors the server-side containsPathTraversal() in WebApplicationFileProcessor.java.
 * Rejects: ".." segments, absolute paths, null bytes, control characters,
 * glob wildcards, backslashes, and percent-encoding.
 *
 * Paths in webapplication.json are bundle-relative and URL-style (like Vercel/Netlify
 * configs), so only forward slashes are supported.  Backslashes are rejected to avoid
 * Windows path-traversal tricks and to keep the config portable across platforms.
 * The server uses the same pure-string logic (no File.separator / Paths.get).
 */
function containsPathTraversal(value: string): string | undefined {
  if (DOT_DOT_SEGMENT.test(value)) return 'path traversal (..)';
  if (value === '..') return 'path traversal (..)';
  if (value.startsWith('/') || value.startsWith('\\')) return 'absolute path';
  if (value.includes('\0')) return 'null byte';
  for (let i = 0; i < value.length; i++) {
    if (value.charCodeAt(i) < 0x20) return 'control character';
  }
  if (value.includes('*') || value.includes('?')) return 'glob wildcard';
  if (value.includes('\\')) return 'backslash (use forward slashes)';
  if (value.includes('%')) return 'percent-encoding';
  return undefined;
}

/** Run containsPathTraversal and throw a descriptive error if the value is unsafe. */
function assertSafePath(value: string, configKey: string): void {
  const reason = containsPathTraversal(value);
  if (reason) {
    throw configError(
      `webapplication.json '${configKey}' value "${value}" contains ${reason}. Config paths must use forward slashes.`,
      [`Fix "${value}": use relative paths with forward slashes only, no special characters.`]
    );
  }
}

/** Return a human-friendly type label for use in error messages (distinguishes null and array from typeof). */
function describeType(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function configError(message: string, actions?: string[]): SfError {
  return new SfError(message, 'InvalidWebApplicationConfigError', actions);
}

function fileError(message: string, actions?: string[]): SfError {
  return new SfError(message, 'ExpectedSourceFilesError', actions);
}

/**
 * Validate the contents of a webapplication.json descriptor.
 *
 * Checks are performed in order: empty/whitespace -> valid JSON -> root type -> schema
 * constraints -> file existence. This ensures the first error the developer sees is
 * the most actionable one.
 *
 * File-existence checks (outputDir, fallback, rewrite targets) only run when outputDir
 * is present, since all referenced paths are relative to it.
 */
function validateWebApplicationJson(
  raw: Buffer,
  descriptorPath: string,
  contentPath: SourcePath,
  tree: TreeContainer
): void {
  if (!raw || raw.length === 0) {
    throw configError(`webapplication.json must not be empty (${descriptorPath}).`, [
      'Add at least one property, e.g. { "outputDir": "dist" }',
    ]);
  }

  if (raw.length > MAX_WEBAPPLICATION_JSON_BYTES) {
    throw configError(
      `webapplication.json exceeds the maximum allowed size of ${MAX_WEBAPPLICATION_JSON_BYTES / 1024} KB (actual: ${(
        raw.length / 1024
      ).toFixed(1)} KB).`,
      ['Reduce the file size. The descriptor should only contain configuration, not static content.']
    );
  }
  const trimmed = raw.toString('utf8').trim();
  if (trimmed.length === 0) {
    throw configError(`webapplication.json must not be empty or contain only whitespace (${descriptorPath}).`, [
      'Replace the whitespace with valid JSON, e.g. { "outputDir": "dist" }',
    ]);
  }

  let config: unknown;
  try {
    config = JSON.parse(trimmed) as unknown;
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    throw configError(`webapplication.json is not valid JSON: ${detail}`, [
      'Fix the JSON syntax in webapplication.json. Use a JSON validator to find the exact issue.',
    ]);
  }

  if (config === null || typeof config !== 'object' || Array.isArray(config)) {
    throw configError(`webapplication.json must be a JSON object, but found ${describeType(config)}.`, [
      'Wrap the content in curly braces, e.g. { "outputDir": "dist" }',
    ]);
  }

  const obj = config as Record<string, unknown>;
  const keys = Object.keys(obj);

  if (keys.length === 0) {
    throw configError('webapplication.json must contain at least one property.', [
      'Add a property: apiVersion, outputDir, routing, or headers.',
    ]);
  }

  // Report all unknown properties at once so the developer can fix them in a single pass.
  const disallowed = keys.filter((k) => !ALLOWED_TOP_LEVEL.has(k));
  if (disallowed.length > 0) {
    const list = disallowed.map((k) => `'${k}'`).join(', ');
    throw configError(
      `webapplication.json contains unknown ${
        disallowed.length === 1 ? 'property' : 'properties'
      }: ${list}. Allowed: apiVersion, outputDir, routing, headers.`,
      [`Remove ${list} from webapplication.json.`]
    );
  }

  if (obj.apiVersion !== undefined) {
    validateApiVersion(obj.apiVersion);
  }

  const outputDir = obj.outputDir !== undefined ? validateOutputDir(obj.outputDir) : undefined;

  if (obj.routing !== undefined) {
    validateRouting(obj.routing);
  }

  if (obj.headers !== undefined) {
    validateHeaders(obj.headers);
  }

  // File-existence checks: when outputDir is present, all paths resolve relative to it.
  // When absent, fallback/rewrite still resolve relative to the bundle content root.
  if (outputDir ?? obj.routing) {
    validateFileExistence(obj, outputDir, contentPath, tree);
  }
}

function validateApiVersion(value: unknown): void {
  if (typeof value !== 'string') {
    throw configError(`webapplication.json 'apiVersion' must be a string (received ${describeType(value)}).`, [
      'Set apiVersion to a string like "66.0".',
    ]);
  }
  if (!API_VERSION_REGEX.test(value)) {
    throw configError(
      `webapplication.json 'apiVersion' must match pattern ^\\d+\\.0$ (e.g. "66.0"), but got "${value}".`,
      ['Use a version string like "66.0" or "67.0".']
    );
  }
}

function validateOutputDir(value: unknown): string {
  if (typeof value !== 'string') {
    throw configError(`webapplication.json 'outputDir' must be a string (received ${describeType(value)}).`, [
      'Set outputDir to a directory path like "dist" or "build".',
    ]);
  }
  if (value.length === 0) {
    throw configError("webapplication.json 'outputDir' must not be empty.", ['Provide a directory name, e.g. "dist".']);
  }
  assertSafePath(value, 'outputDir');
  return value;
}

function validateRouting(value: unknown): void {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw configError(`webapplication.json 'routing' must be an object (received ${describeType(value)}).`, [
      'Set routing to an object, e.g. { "trailingSlash": "auto" }.',
    ]);
  }
  const routing = value as Record<string, unknown>;
  const routingKeys = Object.keys(routing);

  if (routingKeys.length === 0) {
    throw configError("webapplication.json 'routing' must contain at least one property.", [
      'Add a routing property: rewrites, redirects, fallback, trailingSlash, or fileBasedRouting.',
    ]);
  }

  const unknownRouting = routingKeys.filter((k) => !ROUTING_ALLOWED.has(k));
  if (unknownRouting.length > 0) {
    const list = unknownRouting.map((k) => `'${k}'`).join(', ');
    throw configError(
      `webapplication.json 'routing' contains unknown ${
        unknownRouting.length === 1 ? 'property' : 'properties'
      }: ${list}. Allowed: rewrites, redirects, fallback, trailingSlash, fileBasedRouting.`,
      [`Remove ${list} from routing.`]
    );
  }

  if (routing.trailingSlash !== undefined) {
    validateTrailingSlash(routing.trailingSlash);
  }

  if (routing.fileBasedRouting !== undefined && typeof routing.fileBasedRouting !== 'boolean') {
    throw configError(
      `webapplication.json 'routing.fileBasedRouting' must be a boolean (received ${describeType(
        routing.fileBasedRouting
      )}).`
    );
  }

  if (routing.fallback !== undefined) {
    validateFallback(routing.fallback);
  }

  if (routing.rewrites !== undefined) {
    validateRewritesList(routing.rewrites);
  }

  if (routing.redirects !== undefined) {
    validateRedirectsList(routing.redirects);
  }
}

function validateTrailingSlash(value: unknown): void {
  if (typeof value !== 'string') {
    throw configError(
      `webapplication.json 'routing.trailingSlash' must be a string (received ${describeType(value)}).`
    );
  }
  if (!TRAILING_SLASH_VALUES.has(value)) {
    throw configError(
      `webapplication.json 'routing.trailingSlash' must be one of: always, never, auto (received "${value}").`
    );
  }
}

function validateFallback(value: unknown): void {
  if (typeof value !== 'string') {
    throw configError(`webapplication.json 'routing.fallback' must be a string (received ${describeType(value)}).`);
  }
  if (value.length === 0) {
    throw configError("webapplication.json 'routing.fallback' must not be empty.", [
      'Provide a file path like "index.html".',
    ]);
  }
  assertSafePath(value, 'routing.fallback');
}

function validateRewritesList(value: unknown): void {
  if (!Array.isArray(value)) {
    throw configError(`webapplication.json 'routing.rewrites' must be an array (received ${describeType(value)}).`);
  }
  if (value.length === 0) {
    throw configError("webapplication.json 'routing.rewrites' must contain at least one item.", [
      'Add a rewrite entry or remove the empty rewrites array.',
    ]);
  }
  for (let i = 0; i < value.length; i++) {
    validateRewriteItem(value[i], i);
  }
}

function validateRedirectsList(value: unknown): void {
  if (!Array.isArray(value)) {
    throw configError(`webapplication.json 'routing.redirects' must be an array (received ${describeType(value)}).`);
  }
  if (value.length === 0) {
    throw configError("webapplication.json 'routing.redirects' must contain at least one item.", [
      'Add a redirect entry or remove the empty redirects array.',
    ]);
  }
  for (let i = 0; i < value.length; i++) {
    validateRedirectItem(value[i], i);
  }
}

function validateHeaders(value: unknown): void {
  if (!Array.isArray(value)) {
    throw configError(`webapplication.json 'headers' must be an array (received ${describeType(value)}).`);
  }
  if (value.length === 0) {
    throw configError("webapplication.json 'headers' must contain at least one item.", [
      'Add a header entry or remove the empty headers array.',
    ]);
  }
  for (let i = 0; i < value.length; i++) {
    validateHeaderItem(value[i], i);
  }
}

function validateRewriteItem(item: unknown, i: number): void {
  if (typeof item !== 'object' || item === null || Array.isArray(item)) {
    throw configError(
      `webapplication.json 'routing.rewrites[${i}]' must be an object (received ${describeType(item)}).`
    );
  }
  const obj = item as Record<string, unknown>;
  if (Object.keys(obj).length === 0) {
    throw configError(`webapplication.json 'routing.rewrites[${i}]' must contain at least one property.`, [
      'Add route and/or rewrite to this entry.',
    ]);
  }
  const unknown = Object.keys(obj).filter((k) => k !== 'route' && k !== 'rewrite');
  if (unknown.length > 0) {
    throw configError(
      `webapplication.json 'routing.rewrites[${i}]' contains unknown property '${unknown[0]}'. Allowed: route, rewrite.`
    );
  }
  if (obj.route !== undefined && (typeof obj.route !== 'string' || obj.route.length === 0)) {
    throw configError(`webapplication.json 'routing.rewrites[${i}].route' must be a non-empty string.`);
  }
  if (obj.rewrite !== undefined) {
    if (typeof obj.rewrite !== 'string' || obj.rewrite.length === 0) {
      throw configError(`webapplication.json 'routing.rewrites[${i}].rewrite' must be a non-empty string.`);
    }
    assertSafePath(obj.rewrite, `routing.rewrites[${i}].rewrite`);
  }
}

function validateRedirectItem(item: unknown, i: number): void {
  if (typeof item !== 'object' || item === null || Array.isArray(item)) {
    throw configError(
      `webapplication.json 'routing.redirects[${i}]' must be an object (received ${describeType(item)}).`
    );
  }
  const obj = item as Record<string, unknown>;
  if (Object.keys(obj).length === 0) {
    throw configError(`webapplication.json 'routing.redirects[${i}]' must contain at least one property.`, [
      'Add route, redirect, and/or statusCode to this entry.',
    ]);
  }
  const unknown = Object.keys(obj).filter((k) => k !== 'route' && k !== 'redirect' && k !== 'statusCode');
  if (unknown.length > 0) {
    throw configError(
      `webapplication.json 'routing.redirects[${i}]' contains unknown property '${unknown[0]}'. Allowed: route, redirect, statusCode.`
    );
  }
  if (obj.route !== undefined && (typeof obj.route !== 'string' || obj.route.length === 0)) {
    throw configError(`webapplication.json 'routing.redirects[${i}].route' must be a non-empty string.`);
  }
  if (obj.redirect !== undefined && (typeof obj.redirect !== 'string' || obj.redirect.length === 0)) {
    throw configError(`webapplication.json 'routing.redirects[${i}].redirect' must be a non-empty string.`);
  }
  if (obj.statusCode !== undefined) {
    if (!Number.isInteger(obj.statusCode) || !REDIRECT_STATUS_CODES.has(obj.statusCode as number)) {
      throw configError(
        `webapplication.json 'routing.redirects[${i}].statusCode' must be one of: 301, 302, 307, 308 (received ${JSON.stringify(
          obj.statusCode
        )}).`
      );
    }
  }
}

function validateHeaderItem(item: unknown, i: number): void {
  if (typeof item !== 'object' || item === null || Array.isArray(item)) {
    throw configError(`webapplication.json 'headers[${i}]' must be an object (received ${describeType(item)}).`);
  }
  const obj = item as Record<string, unknown>;
  if (Object.keys(obj).length === 0) {
    throw configError(`webapplication.json 'headers[${i}]' must contain at least one property.`, [
      'Add source and/or headers to this entry.',
    ]);
  }
  const unknown = Object.keys(obj).filter((k) => k !== 'source' && k !== 'headers');
  if (unknown.length > 0) {
    throw configError(
      `webapplication.json 'headers[${i}]' contains unknown property '${unknown[0]}'. Allowed: source, headers.`
    );
  }
  if (obj.source !== undefined && (typeof obj.source !== 'string' || obj.source.length === 0)) {
    throw configError(`webapplication.json 'headers[${i}].source' must be a non-empty string.`);
  }
  if (obj.headers !== undefined) {
    if (!Array.isArray(obj.headers)) {
      throw configError(
        `webapplication.json 'headers[${i}].headers' must be an array (received ${describeType(obj.headers)}).`
      );
    }
    if (obj.headers.length === 0) {
      throw configError(`webapplication.json 'headers[${i}].headers' must contain at least one item.`, [
        'Add a { "key": "...", "value": "..." } entry or remove the empty array.',
      ]);
    }
    for (let j = 0; j < obj.headers.length; j++) {
      validateHeaderKeyValue(obj.headers[j], i, j);
    }
  }
}

function validateHeaderKeyValue(item: unknown, i: number, j: number): void {
  if (typeof item !== 'object' || item === null || Array.isArray(item)) {
    throw configError(
      `webapplication.json 'headers[${i}].headers[${j}]' must be an object (received ${describeType(item)}).`
    );
  }
  const obj = item as Record<string, unknown>;
  if (Object.keys(obj).length === 0) {
    throw configError(`webapplication.json 'headers[${i}].headers[${j}]' must contain at least one property.`, [
      'Add key and/or value to this header entry.',
    ]);
  }
  const unknown = Object.keys(obj).filter((k) => k !== 'key' && k !== 'value');
  if (unknown.length > 0) {
    throw configError(
      `webapplication.json 'headers[${i}].headers[${j}]' contains unknown property '${unknown[0]}'. Allowed: key, value.`
    );
  }
  if (obj.key !== undefined && (typeof obj.key !== 'string' || obj.key.length === 0)) {
    throw configError(`webapplication.json 'headers[${i}].headers[${j}].key' must be a non-empty string.`);
  }
  if (obj.value !== undefined && (typeof obj.value !== 'string' || obj.value.length === 0)) {
    throw configError(`webapplication.json 'headers[${i}].headers[${j}].value' must be a non-empty string.`);
  }
}

/** Ensure a resolved path stays within the expected parent directory to prevent path traversal. */
function assertNoTraversal(resolvedPath: string, parentDir: string, configKey: string, rawValue: string): void {
  const normalizedResolved = resolve(resolvedPath);
  const normalizedParent = resolve(parentDir) + sep;
  if (!normalizedResolved.startsWith(normalizedParent) && normalizedResolved !== resolve(parentDir)) {
    throw configError(
      `webapplication.json '${configKey}' value "${rawValue}" resolves outside the application bundle. Path traversal is not allowed.`,
      [`Remove ".." segments from "${rawValue}". Paths must stay within the bundle directory.`]
    );
  }
}

/**
 * Verify that outputDir, fallback, and rewrite targets reference files that exist in the bundle.
 *
 * When outputDir is provided, paths resolve relative to it.
 * When outputDir is absent, fallback and rewrite paths resolve relative to the bundle content root.
 */
function validateFileExistence(
  obj: Record<string, unknown>,
  outputDir: string | undefined,
  contentPath: SourcePath,
  tree: TreeContainer
): void {
  let basePath = contentPath;

  if (outputDir) {
    const outputDirPath = join(contentPath, outputDir);
    assertNoTraversal(outputDirPath, contentPath, 'outputDir', outputDir);

    if (resolve(outputDirPath) === resolve(contentPath)) {
      throw configError(
        `webapplication.json 'outputDir' value "${outputDir}" resolves to the bundle root. It must reference a subdirectory.`,
        ['Set outputDir to a subdirectory like "dist" or "build".']
      );
    }

    if (!tree.exists(outputDirPath) || !tree.isDirectory(outputDirPath)) {
      throw fileError(
        `webapplication.json 'outputDir' references "${outputDir}", but the directory does not exist at ${outputDirPath}.`,
        [
          `Create the directory "${outputDir}" in your web application bundle, or change outputDir to an existing directory.`,
        ]
      );
    }

    const hasFileUnder = (dirPath: SourcePath, depth = 0): boolean => {
      if (depth > MAX_RECURSION_DEPTH) return false;
      const entries = tree.readDirectory(dirPath);
      for (const entry of entries) {
        const fullPath = join(dirPath, entry);
        if (tree.exists(fullPath)) {
          if (tree.isDirectory(fullPath)) {
            if (hasFileUnder(fullPath, depth + 1)) return true;
          } else {
            return true;
          }
        }
      }
      return false;
    };

    if (!hasFileUnder(outputDirPath)) {
      throw fileError(
        `webapplication.json 'outputDir' ("${outputDir}") exists but contains no files. It must contain at least one deployable file.`,
        [`Add files to "${outputDir}", e.g. an index.html.`]
      );
    }

    basePath = outputDirPath;
  }

  const baseLabel = outputDir ?? 'bundle root';
  const routing = obj.routing as Record<string, unknown> | undefined;

  if (routing?.fallback && typeof routing.fallback === 'string') {
    const stripped = stripLeadingSep(routing.fallback);
    const fallbackPath = join(basePath, stripped);
    assertNoTraversal(fallbackPath, basePath, 'routing.fallback', routing.fallback);
    if (!tree.exists(fallbackPath)) {
      throw fileError(
        `webapplication.json 'routing.fallback' references "${routing.fallback}", but the file does not exist at ${fallbackPath}.`,
        [`Create the file "${stripped}" inside "${baseLabel}", or update the fallback path.`]
      );
    }
  }

  const rewrites = routing?.rewrites as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(rewrites)) {
    for (let i = 0; i < rewrites.length; i++) {
      const target = rewrites[i].rewrite;
      if (target && typeof target === 'string') {
        const stripped = stripLeadingSep(target);
        const rewritePath = join(basePath, stripped);
        assertNoTraversal(rewritePath, basePath, `routing.rewrites[${i}].rewrite`, target);
        if (!tree.exists(rewritePath)) {
          throw fileError(
            `webapplication.json 'routing.rewrites[${i}].rewrite' references "${target}", but the file does not exist at ${rewritePath}.`,
            [`Create the file "${stripped}" inside "${baseLabel}", or update the rewrite path.`]
          );
        }
      }
    }
  }
}

/**
 * Source adapter for WebApplication bundles.
 *
 * A WebApplication bundle contains a `-meta.xml`, an optional `webapplication.json`
 * descriptor, and static content files (HTML, JS, CSS, etc.).  The descriptor is
 * validated during source resolution (deploy) but not during retrieve, since the
 * org already validates it server-side.
 *
 * __Example Structure__:
 * ```text
 * webapplications/
 * └── MyApp/
 *     ├── MyApp.webapplication-meta.xml
 *     ├── webapplication.json          (optional)
 *     └── dist/
 *         ├── index.html
 *         └── assets/
 *             └── main.js
 * ```
 */
export class WebApplicationsSourceAdapter extends BundleSourceAdapter {
  protected populate(
    trigger: SourcePath,
    component?: SourceComponent,
    isResolvingSource = true
  ): SourceComponent | undefined {
    const source = super.populate(trigger, component);
    if (!source?.content) {
      return source;
    }

    const contentPath = source.content;
    const appName = baseName(contentPath);
    const expectedXmlPath = join(contentPath, `${appName}.webapplication-meta.xml`);
    if (!this.tree.exists(expectedXmlPath)) {
      throw new SfError(
        messages.getMessage('error_expected_source_files', [expectedXmlPath, this.type.name]),
        'ExpectedSourceFilesError'
      );
    }

    // BundleSourceAdapter may resolve xml to the wrong path when triggered from
    // a child file; ensure the component always points at the canonical meta xml.
    const resolvedSource =
      source.xml && source.xml === expectedXmlPath
        ? source
        : new SourceComponent(
            {
              name: appName,
              type: source.type,
              content: source.content,
              xml: expectedXmlPath,
              parent: source.parent,
              parentType: source.parentType,
            },
            this.tree,
            this.forceIgnore
          );

    // Validate the descriptor only when resolving local source (deploy path).
    // During retrieve the tree is a ZipTreeContainer whose readFileSync is not
    // implemented — we catch that and skip, since the org already validated it.
    if (isResolvingSource) {
      const descriptorPath = join(contentPath, 'webapplication.json');
      const hasDescriptor = this.tree.exists(descriptorPath) && !this.forceIgnore.denies(descriptorPath);

      if (hasDescriptor) {
        try {
          const raw = this.tree.readFileSync(descriptorPath);
          validateWebApplicationJson(raw, descriptorPath, contentPath, this.tree);
        } catch (e) {
          if (e instanceof Error && e.message === 'Method not implemented') {
            // ZipTreeContainer (retrieve path) — skip client-side validation
          } else {
            throw e;
          }
        }
      }
    }

    return resolvedSource;
  }
}
