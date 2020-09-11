/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export const FORCE_IGNORE_FILE = '.forceignore';
export const META_XML_SUFFIX = '-meta.xml';
export const PACKAGE_XML_FILE = 'package.xml';
export const DEFAULT_PACKAGE_PREFIX = 'metadataPackage';
export const XML_NS_KEY = '@_xmlns';
export const XML_NS = 'http://soap.sforce.com/2006/04/metadata';
export const XML_DECL = '<?xml version="1.0" encoding="UTF-8"?>\n';
export const ARCHIVE_MIME_TYPES = new Set([
  'application/zip',
  'application/x-zip-compressed',
  'application/jar',
  'application/octet-stream',
]);
export const FALLBACK_TYPE_MAP = new Map<string, string>([
  ['text/javascript', 'js'],
  ['application/x-javascript', 'js'],
  ['application/x-zip-compressed', 'zip'],
  ['text/x-haml', 'haml'],
  ['image/x-png', 'png'],
  ['text/xml', 'xml'],
]);
