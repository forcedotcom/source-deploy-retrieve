/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { PerformanceObserver, performance } from 'node:perf_hooks';
import * as path from 'path';
import * as os from 'os';
import { TestSession } from '@salesforce/cli-plugins-testkit';
// import { expect } from 'chai';
import * as fs from 'graceful-fs';
import { MetadataResolver } from '../../../src';
import { MetadataConverter } from '../../../src';
import { ComponentSetBuilder } from '../../../src';
const dirCount = 1;
const classesPerDir = 1;
const classCount = dirCount * classesPerDir;

const testName = 'lotsOfClasses';
const testPath = path.join(
  'test',
  'nuts',
  'perf',
  testName,
  `${os.arch()}-${os.platform()}-${os.cpus().length}x${os.cpus()[0].model}`
);
const obs = new PerformanceObserver((items) => {
  // eslint-disable-next-line no-console
  console.log(items.getEntries()[0].duration);
  fs.mkdirSync(testPath, { recursive: true });
  fs.writeFileSync(
    path.join(testPath, `${items.getEntries()[0].name}.json`),
    items.getEntries()[0].duration.toString()
  );
  performance.clearMarks();
});
obs.observe({ type: 'measure' });

describe(`handles ${classCount.toLocaleString()} classes (${(
  classCount * 2
).toLocaleString()} files across ${dirCount.toLocaleString()} folders)`, () => {
  let session: TestSession;

  before(async () => {
    session = await TestSession.create({
      project: {
        name: 'lotsOfClasses',
      },
      authStrategy: 'NONE',
    });
    // create some number of files
    const classdir = path.join(session.project.dir, 'force-app', 'main', 'default', 'classes');
    for (let d = 0; d < dirCount; d++) {
      const dirName = path.join(classdir, `dir${d}`);
      // eslint-disable-next-line no-await-in-loop
      await fs.promises.mkdir(dirName);
      for (let c = 0; c < classesPerDir; c++) {
        const className = `x${d}x${c}`;
        // eslint-disable-next-line no-await-in-loop
        await Promise.all([
          fs.promises.writeFile(
            path.join(dirName, `${className}.cls`),
            `public with sharing class ${className} {public ${className}() {}}`
          ),
          fs.promises.writeFile(
            path.join(dirName, `${className}.cls-meta.xml`),
            '<?xml version="1.0" encoding="UTF-8"?><ApexClass xmlns="http://soap.sforce.com/2006/04/metadata"><apiVersion>54.0</apiVersion><status>Active</status></ApexClass>'
          ),
        ]);
      }
    }
  });

  after(async () => {
    await session?.clean();
  });

  it('componentSetBuilder', async () => {
    performance.mark('ComponentSetBuild');

    await ComponentSetBuilder.build({
      sourcepath: [session.project.dir],
    });
    performance.measure('ComponentSetBuild to Now', 'ComponentSetBuild');
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
    performance.measure('SourceToMdapi to Now', 'SourceToMdapi');
  });
  it('convert source to zip', async () => {});
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
    performance.measure('MdapiToSource to Now', 'MdapiToSource');
  });
  it('convert zip to source', async () => {});
});
