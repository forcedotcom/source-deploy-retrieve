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

Messages.importMessagesDirectory(__dirname);
const msgs = Messages.loadMessages('@salesforce/source-deploy-retrieve', 'webApplicationValidation');

// Mirrors the server-side schema in WebApplicationFileProcessor.java.

type TrailingSlash = 'always' | 'never' | 'auto';
type RedirectStatusCode = 301 | 302 | 307 | 308;

export type WebApplicationRewrite = {
  route?: string;
  rewrite?: string;
};

export type WebApplicationRedirect = {
  route?: string;
  redirect?: string;
  statusCode?: RedirectStatusCode;
};

export type WebApplicationHeaderKeyValue = {
  key?: string;
  value?: string;
};

export type WebApplicationHeaderRule = {
  source?: string;
  headers?: WebApplicationHeaderKeyValue[];
};

export type WebApplicationRouting = {
  rewrites?: WebApplicationRewrite[];
  redirects?: WebApplicationRedirect[];
  fallback?: string;
  trailingSlash?: TrailingSlash;
  fileBasedRouting?: boolean;
};

export type WebApplicationConfig = {
  outputDir?: string;
  routing?: WebApplicationRouting;
  headers?: WebApplicationHeaderRule[];
};

/** Basic shape check — use after field-level validation to narrow the type. */
export function isWebApplicationConfig(value: unknown): value is WebApplicationConfig {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Keep in sync with server-side validation (WebApplicationFileProcessor.java).
const ALLOWED_TOP_LEVEL = new Set(['outputDir', 'routing', 'headers']);
const ROUTING_ALLOWED = new Set(['rewrites', 'redirects', 'fallback', 'trailingSlash', 'fileBasedRouting']);
const TRAILING_SLASH_VALUES = new Set(['always', 'never', 'auto']);
const REDIRECT_STATUS_CODES = new Set([301, 302, 307, 308]);
const MAX_RECURSION_DEPTH = 20;
const MAX_WEBAPPLICATION_JSON_BYTES = 102_400; // 100 KB

// Matches ".." as a standalone path segment.
const DOT_DOT_SEGMENT = /(?:^|[/\\])\.\.[/\\]|(?:^|[/\\])\.\.$/;

/** Strip leading forward slashes so "/index.html" resolves relative to outputDir. Only strips '/', not backslashes. */
function stripLeadingSep(p: string): string {
  return p.replace(/^\/+/, '');
}

/** Returns a reason string if the path contains unsafe patterns, undefined otherwise. */
function containsPathTraversal(value: string): string | undefined {
  if (DOT_DOT_SEGMENT.test(value)) {
    return 'path traversal (..)';
  }
  if (value === '..') {
    return 'path traversal (..)';
  }
  if (value === '.' || value === './') {
    return 'current directory reference (use a file path)';
  }
  if (value.startsWith('/') || value.startsWith('\\')) {
    return 'absolute path';
  }
  if (value.includes('\0')) {
    return 'null byte';
  }
  for (let i = 0; i < value.length; i++) {
    if (value.charCodeAt(i) < 0x20) {
      return 'control character';
    }
  }
  if (value.includes('*') || value.includes('?')) {
    return 'glob wildcard';
  }
  if (value.includes('\\')) {
    return 'backslash (use forward slashes)';
  }
  if (value.includes('%')) {
    return 'percent-encoding';
  }
  return undefined;
}

/** Throws if the path looks unsafe (traversal, absolute, special chars, etc.). */
function assertSafePath(value: string, configKey: string): void {
  const reason = containsPathTraversal(value);
  if (reason) {
    throw createConfigError(msgs.getMessage('webapp_path_unsafe', [configKey, value, reason]), [
      `Fix "${value}": use relative paths with forward slashes only, no special characters.`,
    ]);
  }
}

/** Like typeof, but returns "null" or "array" when appropriate. */
function describeType(value: unknown): string {
  if (value === null) {
    return 'null';
  }
  if (Array.isArray(value)) {
    return 'array';
  }
  return typeof value;
}

function createConfigError(message: string, actions?: string[]): SfError {
  return new SfError(message, 'InvalidWebApplicationConfigError', actions);
}

function createFileError(message: string, actions?: string[]): SfError {
  return new SfError(message, 'ExpectedSourceFilesError', actions);
}

/** Validate ui-bundle.json contents. Checks structure first, then schema, then file existence. */
export function validateWebApplicationJson(
  raw: Buffer,
  descriptorPath: string,
  contentPath: SourcePath,
  tree: TreeContainer
): void {
  if (!raw || raw.length === 0) {
    throw createConfigError(msgs.getMessage('webapp_empty_file', [descriptorPath]), [
      msgs.getMessage('webapp_empty_file.actions'),
    ]);
  }

  if (raw.length > MAX_WEBAPPLICATION_JSON_BYTES) {
    throw createConfigError(
      msgs.getMessage('webapp_size_exceeded', [
        String(MAX_WEBAPPLICATION_JSON_BYTES / 1024),
        (raw.length / 1024).toFixed(1),
      ]),
      [msgs.getMessage('webapp_size_exceeded.actions')]
    );
  }

  const trimmed = raw.toString('utf8').trim();
  if (trimmed.length === 0) {
    throw createConfigError(msgs.getMessage('webapp_whitespace_only', [descriptorPath]), [
      msgs.getMessage('webapp_whitespace_only.actions'),
    ]);
  }

  let config: unknown;
  try {
    config = JSON.parse(trimmed) as unknown;
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    throw createConfigError(msgs.getMessage('webapp_invalid_json', [detail]), [
      msgs.getMessage('webapp_invalid_json.actions'),
    ]);
  }

  if (!isWebApplicationConfig(config)) {
    throw createConfigError(msgs.getMessage('webapp_not_object', [describeType(config)]), [
      msgs.getMessage('webapp_not_object.actions'),
    ]);
  }

  const rawObj = config as Record<string, unknown>;
  const keys = Object.keys(rawObj);

  if (keys.length === 0) {
    throw createConfigError(msgs.getMessage('webapp_empty_object'), [msgs.getMessage('webapp_empty_object.actions')]);
  }

  // Report all unknown properties at once.
  const disallowed = keys.filter((k) => !ALLOWED_TOP_LEVEL.has(k));
  if (disallowed.length > 0) {
    const list = disallowed.map((k) => `'${k}'`).join(', ');
    const word = disallowed.length === 1 ? 'property' : 'properties';
    throw createConfigError(msgs.getMessage('webapp_unknown_props', [word, list, 'outputDir, routing, headers']), [
      `Remove ${list} from ui-bundle.json.`,
    ]);
  }

  const outputDir = rawObj.outputDir !== undefined ? validateOutputDir(rawObj.outputDir) : undefined;

  if (rawObj.routing !== undefined) {
    validateRouting(rawObj.routing);
  }

  if (rawObj.headers !== undefined) {
    validateHeaders(rawObj.headers);
  }

  // Safe to cast after field-level checks pass.
  const obj = rawObj as WebApplicationConfig;

  if (outputDir ?? obj.routing) {
    validateFileExistence(obj, outputDir, contentPath, tree);
  }
}

function validateOutputDir(value: unknown): string {
  if (typeof value !== 'string') {
    throw createConfigError(msgs.getMessage('webapp_type_mismatch', ['outputDir', 'a string', describeType(value)]), [
      'Set outputDir to a directory path like "dist" or "build".',
    ]);
  }
  const stripped = stripLeadingSep(value);
  if (stripped.length === 0) {
    throw createConfigError(msgs.getMessage('webapp_empty_value', ['outputDir']), [
      'Provide a directory name, e.g. "dist".',
    ]);
  }
  assertSafePath(stripped, 'outputDir');
  return stripped;
}

function validateRouting(value: unknown): void {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw createConfigError(msgs.getMessage('webapp_type_mismatch', ['routing', 'an object', describeType(value)]), [
      'Set routing to an object, e.g. { "trailingSlash": "auto" }.',
    ]);
  }
  const routing = value as Record<string, unknown>;
  const routingKeys = Object.keys(routing);

  if (routingKeys.length === 0) {
    throw createConfigError(msgs.getMessage('webapp_min_items', ['routing', 'property']), [
      'Add a routing property: rewrites, redirects, fallback, trailingSlash, or fileBasedRouting.',
    ]);
  }

  const unknownRouting = routingKeys.filter((k) => !ROUTING_ALLOWED.has(k));
  if (unknownRouting.length > 0) {
    const list = unknownRouting.map((k) => `'${k}'`).join(', ');
    const word = unknownRouting.length === 1 ? 'property' : 'properties';
    throw createConfigError(
      msgs.getMessage('webapp_unknown_props', [
        word,
        list,
        'rewrites, redirects, fallback, trailingSlash, fileBasedRouting',
      ]),
      [`Remove ${list} from routing.`]
    );
  }

  if (routing.trailingSlash !== undefined) {
    validateTrailingSlash(routing.trailingSlash);
  }

  if (routing.fileBasedRouting !== undefined && typeof routing.fileBasedRouting !== 'boolean') {
    throw createConfigError(
      msgs.getMessage('webapp_type_mismatch', [
        'routing.fileBasedRouting',
        'a boolean',
        describeType(routing.fileBasedRouting),
      ])
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
    throw createConfigError(
      msgs.getMessage('webapp_type_mismatch', ['routing.trailingSlash', 'a string', describeType(value)])
    );
  }
  if (!TRAILING_SLASH_VALUES.has(value)) {
    throw createConfigError(
      msgs.getMessage('webapp_invalid_enum', ['routing.trailingSlash', 'always, never, auto', value])
    );
  }
}

function validateFallback(value: unknown): void {
  if (typeof value !== 'string') {
    throw createConfigError(
      msgs.getMessage('webapp_type_mismatch', ['routing.fallback', 'a string', describeType(value)])
    );
  }
  const stripped = stripLeadingSep(value);
  if (stripped.length === 0) {
    throw createConfigError(msgs.getMessage('webapp_empty_value', ['routing.fallback']), [
      'Provide a file path like "index.html".',
    ]);
  }
  assertSafePath(stripped, 'routing.fallback');
}

function validateRewritesList(value: unknown): void {
  if (!Array.isArray(value)) {
    throw createConfigError(
      msgs.getMessage('webapp_type_mismatch', ['routing.rewrites', 'an array', describeType(value)])
    );
  }
  if (value.length === 0) {
    throw createConfigError(msgs.getMessage('webapp_min_items', ['routing.rewrites', 'item']), [
      'Add a rewrite entry or remove the empty rewrites array.',
    ]);
  }
  for (let i = 0; i < value.length; i++) {
    validateRewriteItem(value[i], i);
  }
}

function validateRedirectsList(value: unknown): void {
  if (!Array.isArray(value)) {
    throw createConfigError(
      msgs.getMessage('webapp_type_mismatch', ['routing.redirects', 'an array', describeType(value)])
    );
  }
  if (value.length === 0) {
    throw createConfigError(msgs.getMessage('webapp_min_items', ['routing.redirects', 'item']), [
      'Add a redirect entry or remove the empty redirects array.',
    ]);
  }
  for (let i = 0; i < value.length; i++) {
    validateRedirectItem(value[i], i);
  }
}

function validateHeaders(value: unknown): void {
  if (!Array.isArray(value)) {
    throw createConfigError(msgs.getMessage('webapp_type_mismatch', ['headers', 'an array', describeType(value)]));
  }
  if (value.length === 0) {
    throw createConfigError(msgs.getMessage('webapp_min_items', ['headers', 'item']), [
      'Add a header entry or remove the empty headers array.',
    ]);
  }
  for (let i = 0; i < value.length; i++) {
    validateHeaderItem(value[i], i);
  }
}

function validateRewriteItem(item: unknown, i: number): void {
  const key = `routing.rewrites[${i}]`;
  if (typeof item !== 'object' || item === null || Array.isArray(item)) {
    throw createConfigError(msgs.getMessage('webapp_type_mismatch', [key, 'an object', describeType(item)]));
  }
  const obj = item as Record<string, unknown>;
  if (Object.keys(obj).length === 0) {
    throw createConfigError(msgs.getMessage('webapp_min_items', [key, 'property']), [
      'Add route and/or rewrite to this entry.',
    ]);
  }
  const unknown = Object.keys(obj).filter((k) => k !== 'route' && k !== 'rewrite');
  if (unknown.length > 0) {
    throw createConfigError(msgs.getMessage('webapp_unknown_prop', [key, unknown[0], 'route, rewrite']));
  }
  if (obj.route !== undefined && (typeof obj.route !== 'string' || obj.route.length === 0)) {
    throw createConfigError(msgs.getMessage('webapp_non_empty_string', [`${key}.route`]));
  }
  if (obj.rewrite !== undefined) {
    if (typeof obj.rewrite !== 'string' || obj.rewrite.length === 0) {
      throw createConfigError(msgs.getMessage('webapp_non_empty_string', [`${key}.rewrite`]));
    }
    const strippedRewrite = stripLeadingSep(obj.rewrite);
    if (strippedRewrite.length === 0) {
      throw createConfigError(msgs.getMessage('webapp_empty_value', [`${key}.rewrite`]), [
        'Provide a file path like "index.html".',
      ]);
    }
    assertSafePath(strippedRewrite, `${key}.rewrite`);
  }
}

function validateRedirectItem(item: unknown, i: number): void {
  const key = `routing.redirects[${i}]`;
  if (typeof item !== 'object' || item === null || Array.isArray(item)) {
    throw createConfigError(msgs.getMessage('webapp_type_mismatch', [key, 'an object', describeType(item)]));
  }
  const obj = item as Record<string, unknown>;
  if (Object.keys(obj).length === 0) {
    throw createConfigError(msgs.getMessage('webapp_min_items', [key, 'property']), [
      'Add route, redirect, and/or statusCode to this entry.',
    ]);
  }
  const unknown = Object.keys(obj).filter((k) => k !== 'route' && k !== 'redirect' && k !== 'statusCode');
  if (unknown.length > 0) {
    throw createConfigError(msgs.getMessage('webapp_unknown_prop', [key, unknown[0], 'route, redirect, statusCode']));
  }
  if (obj.route !== undefined && (typeof obj.route !== 'string' || obj.route.length === 0)) {
    throw createConfigError(msgs.getMessage('webapp_non_empty_string', [`${key}.route`]));
  }
  if (obj.redirect !== undefined && (typeof obj.redirect !== 'string' || obj.redirect.length === 0)) {
    throw createConfigError(msgs.getMessage('webapp_non_empty_string', [`${key}.redirect`]));
  }
  if (obj.statusCode !== undefined) {
    if (!Number.isInteger(obj.statusCode) || !REDIRECT_STATUS_CODES.has(obj.statusCode as number)) {
      throw createConfigError(
        msgs.getMessage('webapp_invalid_enum', [
          `${key}.statusCode`,
          '301, 302, 307, 308',
          JSON.stringify(obj.statusCode),
        ])
      );
    }
  }
}

function validateHeaderItem(item: unknown, i: number): void {
  const key = `headers[${i}]`;
  if (typeof item !== 'object' || item === null || Array.isArray(item)) {
    throw createConfigError(msgs.getMessage('webapp_type_mismatch', [key, 'an object', describeType(item)]));
  }
  const obj = item as Record<string, unknown>;
  if (Object.keys(obj).length === 0) {
    throw createConfigError(msgs.getMessage('webapp_min_items', [key, 'property']), [
      'Add source and/or headers to this entry.',
    ]);
  }
  const unknown = Object.keys(obj).filter((k) => k !== 'source' && k !== 'headers');
  if (unknown.length > 0) {
    throw createConfigError(msgs.getMessage('webapp_unknown_prop', [key, unknown[0], 'source, headers']));
  }
  if (obj.source !== undefined && (typeof obj.source !== 'string' || obj.source.length === 0)) {
    throw createConfigError(msgs.getMessage('webapp_non_empty_string', [`${key}.source`]));
  }
  if (obj.headers !== undefined) {
    if (!Array.isArray(obj.headers)) {
      throw createConfigError(
        msgs.getMessage('webapp_type_mismatch', [`${key}.headers`, 'an array', describeType(obj.headers)])
      );
    }
    if (obj.headers.length === 0) {
      throw createConfigError(msgs.getMessage('webapp_min_items', [`${key}.headers`, 'item']), [
        'Add a { "key": "...", "value": "..." } entry or remove the empty array.',
      ]);
    }
    for (let j = 0; j < obj.headers.length; j++) {
      validateHeaderKeyValue(obj.headers[j], i, j);
    }
  }
}

function validateHeaderKeyValue(item: unknown, i: number, j: number): void {
  const key = `headers[${i}].headers[${j}]`;
  if (typeof item !== 'object' || item === null || Array.isArray(item)) {
    throw createConfigError(msgs.getMessage('webapp_type_mismatch', [key, 'an object', describeType(item)]));
  }
  const obj = item as Record<string, unknown>;
  if (Object.keys(obj).length === 0) {
    throw createConfigError(msgs.getMessage('webapp_min_items', [key, 'property']), [
      'Add key and/or value to this header entry.',
    ]);
  }
  const unknown = Object.keys(obj).filter((k) => k !== 'key' && k !== 'value');
  if (unknown.length > 0) {
    throw createConfigError(msgs.getMessage('webapp_unknown_prop', [key, unknown[0], 'key, value']));
  }
  if (obj.key !== undefined && (typeof obj.key !== 'string' || obj.key.length === 0)) {
    throw createConfigError(msgs.getMessage('webapp_non_empty_string', [`${key}.key`]));
  }
  if (obj.value !== undefined && (typeof obj.value !== 'string' || obj.value.length === 0)) {
    throw createConfigError(msgs.getMessage('webapp_non_empty_string', [`${key}.value`]));
  }
}

/** Throws if the resolved path lands outside the parent directory. */
function assertNoTraversal(resolvedPath: string, parentDir: string, configKey: string, rawValue: string): void {
  const normalizedResolved = resolve(resolvedPath);
  const normalizedParent = resolve(parentDir) + sep;
  if (!normalizedResolved.startsWith(normalizedParent) && normalizedResolved !== resolve(parentDir)) {
    throw createConfigError(msgs.getMessage('webapp_path_traversal', [configKey, rawValue]), [
      `Remove ".." segments from "${rawValue}". Paths must stay within the bundle directory.`,
    ]);
  }
}

/** Verify that referenced paths (outputDir, fallback, rewrite targets) actually exist. */
function validateFileExistence(
  obj: WebApplicationConfig,
  outputDir: string | undefined,
  contentPath: SourcePath,
  tree: TreeContainer
): void {
  let basePath = contentPath;

  if (outputDir) {
    const outputDirPath = join(contentPath, outputDir);
    assertNoTraversal(outputDirPath, contentPath, 'outputDir', outputDir);

    if (resolve(outputDirPath) === resolve(contentPath)) {
      throw createConfigError(msgs.getMessage('webapp_outputdir_is_root', [outputDir]), [
        msgs.getMessage('webapp_outputdir_is_root.actions'),
      ]);
    }

    if (!tree.exists(outputDirPath) || !tree.isDirectory(outputDirPath)) {
      throw createFileError(msgs.getMessage('webapp_dir_not_found', [outputDir, outputDirPath]), [
        `Create the directory "${outputDir}" in your UI bundle, or change outputDir to an existing directory.`,
      ]);
    }

    const hasFileUnder = (dirPath: SourcePath, depth = 0): boolean => {
      if (depth >= MAX_RECURSION_DEPTH) {
        return false;
      }
      const entries = tree.readDirectory(dirPath);
      for (const entry of entries) {
        const fullPath = join(dirPath, entry);
        if (tree.exists(fullPath)) {
          if (tree.isDirectory(fullPath)) {
            if (hasFileUnder(fullPath, depth + 1)) {
              return true;
            }
          } else {
            return true;
          }
        }
      }
      return false;
    };

    if (!hasFileUnder(outputDirPath)) {
      throw createFileError(msgs.getMessage('webapp_dir_empty', [outputDir]), [
        `Add files to "${outputDir}", e.g. an index.html.`,
      ]);
    }

    basePath = outputDirPath;
  }

  const baseLabel = outputDir ?? 'bundle root';
  const { routing } = obj;

  if (routing?.fallback) {
    const stripped = stripLeadingSep(routing.fallback);
    const fallbackPath = join(basePath, stripped);
    assertNoTraversal(fallbackPath, basePath, 'routing.fallback', routing.fallback);
    if (!tree.exists(fallbackPath)) {
      throw createFileError(
        msgs.getMessage('webapp_file_not_found', ['routing.fallback', routing.fallback, fallbackPath]),
        [`Create the file "${stripped}" inside "${baseLabel}", or update the fallback path.`]
      );
    }
  }

  if (routing?.rewrites) {
    for (let i = 0; i < routing.rewrites.length; i++) {
      const target = routing.rewrites[i].rewrite;
      if (target) {
        const stripped = stripLeadingSep(target);
        const rewritePath = join(basePath, stripped);
        assertNoTraversal(rewritePath, basePath, `routing.rewrites[${i}].rewrite`, target);
        if (!tree.exists(rewritePath)) {
          throw createFileError(
            msgs.getMessage('webapp_file_not_found', [`routing.rewrites[${i}].rewrite`, target, rewritePath]),
            [`Create the file "${stripped}" inside "${baseLabel}", or update the rewrite path.`]
          );
        }
      }
    }
  }
}
