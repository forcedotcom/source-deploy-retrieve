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

import * as path from 'node:path';
import { performance } from 'node:perf_hooks';
import { TestSession } from '@salesforce/cli-plugins-testkit';
import { MetadataResolver } from '../../../src';
import { MetadataConverter } from '../../../src';
import { ComponentSetBuilder } from '../../../src';
import { recordPerf } from './perfUtils';

const testName = 'eda';

describe('tests using EDA', () => {
  let session: TestSession;

  before(async () => {
    session = await TestSession.create({
      project: {
        gitClone: 'https://github.com/mshanemc/eda',
      },
      devhubAuthStrategy: 'NONE',
    });
  });

  after(async () => {
    await recordPerf(testName, performance);
    await session?.clean();
  });

  it('componentSetBuilder', async () => {
    performance.mark('ComponentSetBuild');

    await ComponentSetBuilder.build({
      sourcepath: [session.project.dir],
    });
    performance.measure('componentSetCreate', 'ComponentSetBuild');
  });

  it('convert source to mdapi', async () => {
    const resolver = new MetadataResolver();
    const converter = new MetadataConverter();

    performance.mark('SourceToMdapi');

    const components = resolver.getComponentsFromPath(path.join(session.project.dir, 'force-app'));
    await converter.convert(components, 'metadata', {
      type: 'directory',
      outputDirectory: path.join(session.project.dir, 'mdapiOut'),
      packageName: 'MetadataFormatPackage',
    });
    performance.measure('sourceToMdapi', 'SourceToMdapi');
  });
  it('convert source to zip', async () => {
    const resolver = new MetadataResolver();
    const converter = new MetadataConverter();

    performance.mark('SourceToZip');

    const components = resolver.getComponentsFromPath(path.join(session.project.dir, 'force-app'));
    await converter.convert(components, 'metadata', {
      type: 'zip',
      outputDirectory: path.join(session.project.dir, 'mdapiOut'),
      packageName: 'MetadataFormatPackage',
    });
    performance.measure('sourceToZip', 'SourceToZip');
  });
  it('convert mdapi to source', async () => {
    const resolver = new MetadataResolver();
    const converter = new MetadataConverter();

    performance.mark('MdapiToSource');

    const components = resolver.getComponentsFromPath(path.join(session.project.dir, 'mdapiOut'));
    await converter.convert(components, 'source', {
      type: 'directory',
      outputDirectory: path.join(session.project.dir, 'mdapiOut'),
      packageName: 'SourceFormatPackage',
    });
    performance.measure('mdapiToSource', 'MdapiToSource');
  });
});
