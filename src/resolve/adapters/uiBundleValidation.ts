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
import { NodeFSTreeContainer, type TreeContainer } from '../treeContainers';
import type { ForceIgnore } from '../forceIgnore';
import { SourcePath } from '../../common/types';

Messages.importMessagesDirectory(__dirname);
const msgs = Messages.loadMessages('@salesforce/source-deploy-retrieve', 'uiBundleValidation');

// Mirrors the server-side schema in WebApplicationFileProcessor.java.

type TrailingSlash = 'always' | 'never' | 'auto';
type RedirectStatusCode = 301 | 302 | 307 | 308;

export type UiBundleRewrite = {
  route?: string;
  rewrite?: string;
};

export type UiBundleRedirect = {
  route?: string;
  redirect?: string;
  statusCode?: RedirectStatusCode;
};

export type UiBundleHeaderKeyValue = {
  key?: string;
  value?: string;
};

export type UiBundleHeaderRule = {
  source?: string;
  headers?: UiBundleHeaderKeyValue[];
};

export type UiBundleRouting = {
  rewrites?: UiBundleRewrite[];
  redirects?: UiBundleRedirect[];
  fallback?: string;
  trailingSlash?: TrailingSlash;
  fileBasedRouting?: boolean;
};

export type UiBundleMcpResource = {
  name?: string;
  path?: string;
};

export type UiBundleConfig = {
  outputDir?: string;
  routing?: UiBundleRouting;
  headers?: UiBundleHeaderRule[];
  mcpResources?: UiBundleMcpResource[];
};

/** Basic shape check — use after field-level validation to narrow the type. */
export function isUiBundleConfig(value: unknown): value is UiBundleConfig {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Keep in sync with server-side validation (WebApplicationFileProcessor.java).
const ALLOWED_TOP_LEVEL = new Set(['outputDir', 'routing', 'headers', 'mcpResources']);
const ROUTING_ALLOWED = new Set(['rewrites', 'redirects', 'fallback', 'trailingSlash', 'fileBasedRouting']);
const TRAILING_SLASH_VALUES = new Set(['always', 'never', 'auto']);
const REDIRECT_STATUS_CODES = new Set([301, 302, 307, 308]);
const MAX_RECURSION_DEPTH = 20;
const MAX_UI_BUNDLE_JSON_BYTES = 102_400; // 100 KB
// MCP resource names form the URI segment in ui://ui-bundle/<namespace>/<bundle>/<name>.
const MCP_RESOURCE_NAME = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,79}$/;
const MAX_MCP_RESOURCE_PATH_LENGTH = 512;

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
    throw createConfigError(msgs.getMessage('ui_bundle_path_unsafe', [configKey, value, reason]), [
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
  return new SfError(message, 'InvalidUiBundleConfigError', actions);
}

function createFileError(message: string, actions?: string[]): SfError {
  return new SfError(message, 'ExpectedSourceFilesError', actions);
}

/** Validate a UI bundle's `ui-bundle.json` descriptor (if present) at deploy time. Only runs against a real filesystem. */
export function validateUiBundleForDeploy(
  contentPath: SourcePath,
  tree: TreeContainer,
  forceIgnore: ForceIgnore
): void {
  if (!(tree instanceof NodeFSTreeContainer)) {
    return;
  }

  const descriptorPath = join(contentPath, 'ui-bundle.json');
  if (!tree.exists(descriptorPath) || forceIgnore.denies(descriptorPath)) {
    return;
  }

  const raw = tree.readFileSync(descriptorPath);
  validateUiBundleJson(raw, descriptorPath, contentPath, tree);
}

/** Validate ui-bundle.json contents. Checks structure first, then schema, then file existence. */
export function validateUiBundleJson(
  raw: Buffer,
  descriptorPath: string,
  contentPath: SourcePath,
  tree: TreeContainer
): void {
  if (!raw || raw.length === 0) {
    throw createConfigError(msgs.getMessage('ui_bundle_empty_file', [descriptorPath]), [
      msgs.getMessage('ui_bundle_empty_file.actions'),
    ]);
  }

  if (raw.length > MAX_UI_BUNDLE_JSON_BYTES) {
    throw createConfigError(
      msgs.getMessage('ui_bundle_size_exceeded', [
        String(MAX_UI_BUNDLE_JSON_BYTES / 1024),
        (raw.length / 1024).toFixed(1),
      ]),
      [msgs.getMessage('ui_bundle_size_exceeded.actions')]
    );
  }

  const trimmed = raw.toString('utf8').trim();
  if (trimmed.length === 0) {
    throw createConfigError(msgs.getMessage('ui_bundle_whitespace_only', [descriptorPath]), [
      msgs.getMessage('ui_bundle_whitespace_only.actions'),
    ]);
  }

  let config: unknown;
  try {
    config = JSON.parse(trimmed) as unknown;
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    throw createConfigError(msgs.getMessage('ui_bundle_invalid_json', [detail]), [
      msgs.getMessage('ui_bundle_invalid_json.actions'),
    ]);
  }

  if (!isUiBundleConfig(config)) {
    throw createConfigError(msgs.getMessage('ui_bundle_not_object', [describeType(config)]), [
      msgs.getMessage('ui_bundle_not_object.actions'),
    ]);
  }

  const rawObj = config as Record<string, unknown>;
  const keys = Object.keys(rawObj);

  if (keys.length === 0) {
    throw createConfigError(msgs.getMessage('ui_bundle_empty_object'), [
      msgs.getMessage('ui_bundle_empty_object.actions'),
    ]);
  }

  // Report all unknown properties at once.
  const disallowed = keys.filter((k) => !ALLOWED_TOP_LEVEL.has(k));
  if (disallowed.length > 0) {
    const list = disallowed.map((k) => `'${k}'`).join(', ');
    const word = disallowed.length === 1 ? 'property' : 'properties';
    throw createConfigError(
      msgs.getMessage('ui_bundle_unknown_props', [word, list, [...ALLOWED_TOP_LEVEL].join(', ')]),
      [`Remove ${list} from ui-bundle.json.`]
    );
  }

  const outputDir = rawObj.outputDir !== undefined ? validateOutputDir(rawObj.outputDir) : undefined;

  if (rawObj.routing !== undefined) {
    validateRouting(rawObj.routing);
  }

  if (rawObj.headers !== undefined) {
    validateHeaders(rawObj.headers);
  }

  const mcpResources = rawObj.mcpResources !== undefined ? validateMcpResources(rawObj.mcpResources) : undefined;

  // Safe to cast after field-level checks pass.
  const obj: UiBundleConfig = { ...(rawObj as UiBundleConfig), mcpResources };

  if (outputDir ?? obj.routing ?? obj.mcpResources) {
    validateFileExistence(obj, outputDir, contentPath, tree);
  }
}

function validateOutputDir(value: unknown): string {
  if (typeof value !== 'string') {
    throw createConfigError(
      msgs.getMessage('ui_bundle_type_mismatch', ['outputDir', 'a string', describeType(value)]),
      ['Set outputDir to a directory path like "dist" or "build".']
    );
  }
  const stripped = stripLeadingSep(value);
  if (stripped.length === 0) {
    throw createConfigError(msgs.getMessage('ui_bundle_empty_value', ['outputDir']), [
      'Provide a directory name, e.g. "dist".',
    ]);
  }
  assertSafePath(stripped, 'outputDir');
  return stripped;
}

function validateRouting(value: unknown): void {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw createConfigError(msgs.getMessage('ui_bundle_type_mismatch', ['routing', 'an object', describeType(value)]), [
      'Set routing to an object, e.g. { "trailingSlash": "auto" }.',
    ]);
  }
  const routing = value as Record<string, unknown>;
  const routingKeys = Object.keys(routing);

  if (routingKeys.length === 0) {
    throw createConfigError(msgs.getMessage('ui_bundle_min_items', ['routing', 'property']), [
      'Add a routing property: rewrites, redirects, fallback, trailingSlash, or fileBasedRouting.',
    ]);
  }

  const unknownRouting = routingKeys.filter((k) => !ROUTING_ALLOWED.has(k));
  if (unknownRouting.length > 0) {
    const list = unknownRouting.map((k) => `'${k}'`).join(', ');
    const word = unknownRouting.length === 1 ? 'property' : 'properties';
    throw createConfigError(
      msgs.getMessage('ui_bundle_unknown_props', [
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
      msgs.getMessage('ui_bundle_type_mismatch', [
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
      msgs.getMessage('ui_bundle_type_mismatch', ['routing.trailingSlash', 'a string', describeType(value)])
    );
  }
  if (!TRAILING_SLASH_VALUES.has(value)) {
    throw createConfigError(
      msgs.getMessage('ui_bundle_invalid_enum', ['routing.trailingSlash', 'always, never, auto', value])
    );
  }
}

function validateFallback(value: unknown): void {
  if (typeof value !== 'string') {
    throw createConfigError(
      msgs.getMessage('ui_bundle_type_mismatch', ['routing.fallback', 'a string', describeType(value)])
    );
  }
  const stripped = stripLeadingSep(value);
  if (stripped.length === 0) {
    throw createConfigError(msgs.getMessage('ui_bundle_empty_value', ['routing.fallback']), [
      'Provide a file path like "index.html".',
    ]);
  }
  assertSafePath(stripped, 'routing.fallback');
}

function validateRewritesList(value: unknown): void {
  if (!Array.isArray(value)) {
    throw createConfigError(
      msgs.getMessage('ui_bundle_type_mismatch', ['routing.rewrites', 'an array', describeType(value)])
    );
  }
  if (value.length === 0) {
    throw createConfigError(msgs.getMessage('ui_bundle_min_items', ['routing.rewrites', 'item']), [
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
      msgs.getMessage('ui_bundle_type_mismatch', ['routing.redirects', 'an array', describeType(value)])
    );
  }
  if (value.length === 0) {
    throw createConfigError(msgs.getMessage('ui_bundle_min_items', ['routing.redirects', 'item']), [
      'Add a redirect entry or remove the empty redirects array.',
    ]);
  }
  for (let i = 0; i < value.length; i++) {
    validateRedirectItem(value[i], i);
  }
}

function validateHeaders(value: unknown): void {
  if (!Array.isArray(value)) {
    throw createConfigError(msgs.getMessage('ui_bundle_type_mismatch', ['headers', 'an array', describeType(value)]));
  }
  if (value.length === 0) {
    throw createConfigError(msgs.getMessage('ui_bundle_min_items', ['headers', 'item']), [
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
    throw createConfigError(msgs.getMessage('ui_bundle_type_mismatch', [key, 'an object', describeType(item)]));
  }
  const obj = item as Record<string, unknown>;
  if (Object.keys(obj).length === 0) {
    throw createConfigError(msgs.getMessage('ui_bundle_min_items', [key, 'property']), [
      'Add route and/or rewrite to this entry.',
    ]);
  }
  const unknown = Object.keys(obj).filter((k) => k !== 'route' && k !== 'rewrite');
  if (unknown.length > 0) {
    throw createConfigError(msgs.getMessage('ui_bundle_unknown_prop', [key, unknown[0], 'route, rewrite']));
  }
  if (obj.route !== undefined && (typeof obj.route !== 'string' || obj.route.length === 0)) {
    throw createConfigError(msgs.getMessage('ui_bundle_non_empty_string', [`${key}.route`]));
  }
  if (obj.rewrite !== undefined) {
    if (typeof obj.rewrite !== 'string' || obj.rewrite.length === 0) {
      throw createConfigError(msgs.getMessage('ui_bundle_non_empty_string', [`${key}.rewrite`]));
    }
    const strippedRewrite = stripLeadingSep(obj.rewrite);
    if (strippedRewrite.length === 0) {
      throw createConfigError(msgs.getMessage('ui_bundle_empty_value', [`${key}.rewrite`]), [
        'Provide a file path like "index.html".',
      ]);
    }
    assertSafePath(strippedRewrite, `${key}.rewrite`);
  }
}

function validateRedirectItem(item: unknown, i: number): void {
  const key = `routing.redirects[${i}]`;
  if (typeof item !== 'object' || item === null || Array.isArray(item)) {
    throw createConfigError(msgs.getMessage('ui_bundle_type_mismatch', [key, 'an object', describeType(item)]));
  }
  const obj = item as Record<string, unknown>;
  if (Object.keys(obj).length === 0) {
    throw createConfigError(msgs.getMessage('ui_bundle_min_items', [key, 'property']), [
      'Add route, redirect, and/or statusCode to this entry.',
    ]);
  }
  const unknown = Object.keys(obj).filter((k) => k !== 'route' && k !== 'redirect' && k !== 'statusCode');
  if (unknown.length > 0) {
    throw createConfigError(
      msgs.getMessage('ui_bundle_unknown_prop', [key, unknown[0], 'route, redirect, statusCode'])
    );
  }
  if (obj.route !== undefined && (typeof obj.route !== 'string' || obj.route.length === 0)) {
    throw createConfigError(msgs.getMessage('ui_bundle_non_empty_string', [`${key}.route`]));
  }
  if (obj.redirect !== undefined && (typeof obj.redirect !== 'string' || obj.redirect.length === 0)) {
    throw createConfigError(msgs.getMessage('ui_bundle_non_empty_string', [`${key}.redirect`]));
  }
  if (obj.statusCode !== undefined) {
    if (!Number.isInteger(obj.statusCode) || !REDIRECT_STATUS_CODES.has(obj.statusCode as number)) {
      throw createConfigError(
        msgs.getMessage('ui_bundle_invalid_enum', [
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
    throw createConfigError(msgs.getMessage('ui_bundle_type_mismatch', [key, 'an object', describeType(item)]));
  }
  const obj = item as Record<string, unknown>;
  if (Object.keys(obj).length === 0) {
    throw createConfigError(msgs.getMessage('ui_bundle_min_items', [key, 'property']), [
      'Add source and/or headers to this entry.',
    ]);
  }
  const unknown = Object.keys(obj).filter((k) => k !== 'source' && k !== 'headers');
  if (unknown.length > 0) {
    throw createConfigError(msgs.getMessage('ui_bundle_unknown_prop', [key, unknown[0], 'source, headers']));
  }
  if (obj.source !== undefined && (typeof obj.source !== 'string' || obj.source.length === 0)) {
    throw createConfigError(msgs.getMessage('ui_bundle_non_empty_string', [`${key}.source`]));
  }
  if (obj.headers !== undefined) {
    if (!Array.isArray(obj.headers)) {
      throw createConfigError(
        msgs.getMessage('ui_bundle_type_mismatch', [`${key}.headers`, 'an array', describeType(obj.headers)])
      );
    }
    if (obj.headers.length === 0) {
      throw createConfigError(msgs.getMessage('ui_bundle_min_items', [`${key}.headers`, 'item']), [
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
    throw createConfigError(msgs.getMessage('ui_bundle_type_mismatch', [key, 'an object', describeType(item)]));
  }
  const obj = item as Record<string, unknown>;
  if (Object.keys(obj).length === 0) {
    throw createConfigError(msgs.getMessage('ui_bundle_min_items', [key, 'property']), [
      'Add key and/or value to this header entry.',
    ]);
  }
  const unknown = Object.keys(obj).filter((k) => k !== 'key' && k !== 'value');
  if (unknown.length > 0) {
    throw createConfigError(msgs.getMessage('ui_bundle_unknown_prop', [key, unknown[0], 'key, value']));
  }
  if (obj.key !== undefined && (typeof obj.key !== 'string' || obj.key.length === 0)) {
    throw createConfigError(msgs.getMessage('ui_bundle_non_empty_string', [`${key}.key`]));
  }
  if (obj.value !== undefined && (typeof obj.value !== 'string' || obj.value.length === 0)) {
    throw createConfigError(msgs.getMessage('ui_bundle_non_empty_string', [`${key}.value`]));
  }
}

/** Validates mcpResources and returns the entries with name and path trimmed. */
function validateMcpResources(value: unknown): UiBundleMcpResource[] {
  if (!Array.isArray(value)) {
    throw createConfigError(
      msgs.getMessage('ui_bundle_type_mismatch', ['mcpResources', 'an array', describeType(value)])
    );
  }
  if (value.length === 0) {
    throw createConfigError(msgs.getMessage('ui_bundle_min_items', ['mcpResources', 'item']), [
      'Add a { "name": "...", "path": "..." } entry or remove the empty mcpResources array.',
    ]);
  }
  // Names must be unique within a bundle; the server rejects duplicates.
  const seenNames = new Map<string, number>();
  const resources: UiBundleMcpResource[] = [];
  for (let i = 0; i < value.length; i++) {
    const resource = validateMcpResourceItem(value[i], i);
    const name = resource.name;
    const firstIndex = seenNames.get(name);
    if (firstIndex !== undefined) {
      throw createConfigError(
        msgs.getMessage('ui_bundle_duplicate_value', [`mcpResources[${i}].name`, name, `mcpResources[${firstIndex}]`]),
        ['Give each MCP resource a unique name.']
      );
    }
    seenNames.set(name, i);
    resources.push(resource);
  }
  return resources;
}

/** Validates one mcpResources entry and returns it with name and path trimmed. */
function validateMcpResourceItem(item: unknown, i: number): { name: string; path: string } {
  const key = `mcpResources[${i}]`;
  if (typeof item !== 'object' || item === null || Array.isArray(item)) {
    throw createConfigError(msgs.getMessage('ui_bundle_type_mismatch', [key, 'an object', describeType(item)]));
  }
  const obj = item as Record<string, unknown>;
  const unknown = Object.keys(obj).find((k) => k !== 'name' && k !== 'path');
  if (unknown !== undefined) {
    throw createConfigError(msgs.getMessage('ui_bundle_unknown_prop', [key, unknown, 'name, path']));
  }
  // Unlike routing entries, both fields are required. Core trims both before validating.
  const name = typeof obj.name === 'string' ? obj.name.trim() : '';
  if (name.length === 0) {
    throw createConfigError(msgs.getMessage('ui_bundle_non_empty_string', [`${key}.name`]));
  }
  if (!MCP_RESOURCE_NAME.test(name)) {
    throw createConfigError(msgs.getMessage('ui_bundle_mcp_resource_name_invalid', [`${key}.name`, name]), [
      'Use a name like "hello" or "order-summary.v2".',
    ]);
  }
  const path = typeof obj.path === 'string' ? obj.path.trim() : '';
  if (path.length === 0) {
    throw createConfigError(msgs.getMessage('ui_bundle_non_empty_string', [`${key}.path`]));
  }
  if (path.length > MAX_MCP_RESOURCE_PATH_LENGTH) {
    throw createConfigError(
      msgs.getMessage('ui_bundle_value_too_long', [`${key}.path`, MAX_MCP_RESOURCE_PATH_LENGTH, path.length])
    );
  }
  const strippedPath = stripLeadingSep(path);
  if (strippedPath.length === 0) {
    throw createConfigError(msgs.getMessage('ui_bundle_empty_value', [`${key}.path`]), [
      'Provide a file path like "index.html".',
    ]);
  }
  assertSafePath(strippedPath, `${key}.path`);
  const reason = mcpPathMismatch(path);
  if (reason) {
    throw createConfigError(msgs.getMessage('ui_bundle_path_unsafe', [`${key}.path`, path, reason]), [
      `Fix "${path}": use a plain relative file path like "index.html".`,
    ]);
  }
  if (!path.toLowerCase().endsWith('.html')) {
    throw createConfigError(msgs.getMessage('ui_bundle_mcp_resource_not_html', [`${key}.path`, path]), [
      'Point the MCP resource at a single .html file.',
    ]);
  }
  return { name, path };
}

/**
 * Returns a reason if Core would resolve the trimmed MCP resource path differently than the local file check.
 * Core strips one leading "/", rejects any "..", "//", "#", and ":", and looks the path up verbatim, so it must not rely
 * on normalization.
 */
function mcpPathMismatch(value: string): string | undefined {
  if (value.startsWith('//')) {
    return 'multiple leading slashes';
  }
  if (value.includes('//')) {
    return 'consecutive slashes (//)';
  }
  if (value.includes('#')) {
    return 'a fragment marker (#)';
  }
  if (value.includes(':')) {
    return 'a colon (:)';
  }
  if (value.includes('..')) {
    return 'consecutive dots (..)';
  }
  if (/(?:^|\/)\.(?:\/|$)/.test(value)) {
    return 'a current directory segment (.)';
  }
  return undefined;
}

/** Throws if the resolved path lands outside the parent directory. */
function assertNoTraversal(resolvedPath: string, parentDir: string, configKey: string, rawValue: string): void {
  const normalizedResolved = resolve(resolvedPath);
  const normalizedParent = resolve(parentDir) + sep;
  if (!normalizedResolved.startsWith(normalizedParent) && normalizedResolved !== resolve(parentDir)) {
    throw createConfigError(msgs.getMessage('ui_bundle_path_traversal', [configKey, rawValue]), [
      `Remove ".." segments from "${rawValue}". Paths must stay within the bundle directory.`,
    ]);
  }
}

/** Verify that referenced paths (outputDir, fallback, rewrite targets, MCP resource files) actually exist. */
function validateFileExistence(
  obj: UiBundleConfig,
  outputDir: string | undefined,
  contentPath: SourcePath,
  tree: TreeContainer
): void {
  let basePath = contentPath;

  if (outputDir) {
    const outputDirPath = join(contentPath, outputDir);
    assertNoTraversal(outputDirPath, contentPath, 'outputDir', outputDir);

    if (resolve(outputDirPath) === resolve(contentPath)) {
      throw createConfigError(msgs.getMessage('ui_bundle_outputdir_is_root', [outputDir]), [
        msgs.getMessage('ui_bundle_outputdir_is_root.actions'),
      ]);
    }

    if (!tree.exists(outputDirPath) || !tree.isDirectory(outputDirPath)) {
      throw createFileError(msgs.getMessage('ui_bundle_dir_not_found', [outputDir, outputDirPath]), [
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
      throw createFileError(msgs.getMessage('ui_bundle_dir_empty', [outputDir]), [
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
        msgs.getMessage('ui_bundle_file_not_found', ['routing.fallback', routing.fallback, fallbackPath]),
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
            msgs.getMessage('ui_bundle_file_not_found', [`routing.rewrites[${i}].rewrite`, target, rewritePath]),
            [`Create the file "${stripped}" inside "${baseLabel}", or update the rewrite path.`]
          );
        }
      }
    }
  }

  if (obj.mcpResources) {
    for (let i = 0; i < obj.mcpResources.length; i++) {
      // validateMcpResources guarantees a trimmed, non-empty path.
      const target = obj.mcpResources[i].path!;
      const stripped = stripLeadingSep(target);
      const resourcePath = join(basePath, stripped);
      assertNoTraversal(resourcePath, basePath, `mcpResources[${i}].path`, target);
      if (!tree.exists(resourcePath) || tree.isDirectory(resourcePath)) {
        throw createFileError(
          msgs.getMessage('ui_bundle_file_not_found', [`mcpResources[${i}].path`, target, resourcePath]),
          [`Create the file "${stripped}" inside "${baseLabel}", or update the MCP resource path.`]
        );
      }
    }
  }
}
