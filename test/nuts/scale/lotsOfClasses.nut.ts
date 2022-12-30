/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { performance } from 'node:perf_hooks';
import * as path from 'path';
import { TestSession } from '@salesforce/cli-plugins-testkit';
import * as fs from 'graceful-fs';
import { MetadataResolver } from '../../../src';
import { MetadataConverter } from '../../../src';
import { ComponentSetBuilder } from '../../../src';
import { recordPerf } from './perfUtils';

const dirCount = 50;
const classesPerDir = 100;
const linesInClass = 150;
const classCount = dirCount * classesPerDir;

const testName = 'lotsOfClasses';

describe(`handles ${classCount.toLocaleString()} classes (${(
  classCount * 2
).toLocaleString()} files across ${dirCount.toLocaleString()} folders)`, () => {
  let session: TestSession;

  before(async () => {
    session = await TestSession.create({
      project: {
        name: 'lotsOfClasses',
      },
      devhubAuthStrategy: 'NONE',
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
            `public with sharing class ${className} {public ${className}() { ${Array(linesInClass)
              .fill('// this is a comment meant to take up space in the filesystem')
              .join(path.sep)} } }`
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
