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

import { expect } from 'chai';
import { Messages } from '@salesforce/core';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/source-deploy-retrieve', 'computeApp');

// pins the rendered text (and token order) of messages that tests elsewhere only match partially
describe('computeApp messages', () => {
  const cases: Array<[string, Array<string | number>, string]> = [
    ['missingApiSpec', ['MyApp', '/app'], "ComputeApp 'MyApp' is missing required api-spec.yaml in /app"],
    [
      'missingComponentXml',
      ['MyApp', 'MyApp', '/app'],
      "ComputeApp 'MyApp' is missing MyApp.computeApp-meta.xml in /app",
    ],
    ['missingPackageOption', ['my-pkg', 'MyApp'], "No package option found for 'my-pkg' (component 'MyApp')"],
    ['transportOperationFailed', ['upload', "'MyApp': boom"], "Elastic Compute upload failed for 'MyApp': boom"],
    [
      'bundleFileSizeLimit',
      [16, 'src/big.js'],
      'Compute source bundle: entry size limit (16 bytes) exceeded for src/big.js',
    ],
    [
      'malformedBundleEntrySizeLimit',
      [16, 40],
      'Malformed compute source bundle: entry size limit (16 bytes) or total size limit (40 bytes) exceeded',
    ],
    [
      'malformedBundleUnsupportedEntry',
      ['symlink', 'link'],
      'Malformed compute source bundle: unsupported symlink entry "link"',
    ],
    ['malformedBundleUnsafePath', ['../x'], 'Malformed compute source bundle: unsafe entry path "../x"'],
    ['malformedBundleSymlink', ['/out/app'], 'Malformed compute source bundle: symlink in output path "/out/app"'],
  ];

  for (const [key, tokens, expected] of cases) {
    it(`renders ${key}`, () => {
      expect(messages.getMessage(key, tokens)).to.equal(expected);
    });
  }

  it('names errors created from message keys', () => {
    expect(messages.createError('bundleTotalSizeLimit', [40]).name).to.equal('BundleTotalSizeLimitError');
  });
});
