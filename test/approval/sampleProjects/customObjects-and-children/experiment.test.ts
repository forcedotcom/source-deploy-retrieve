/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import snap from 'mocha-snap';
import { TestSession } from '@salesforce/cli-plugins-testkit';
import { MetadataConverter } from '../../../../src/convert/metadataConverter';
import { ComponentSetBuilder } from '../../../../src/collections/componentSetBuilder';

describe('Custom objects and children', () => {
  let session: TestSession;
  let createdSourceFiles: string[] = [];
  const converter = new MetadataConverter();

  before(async () => {
    session = await TestSession.create({
      project: {
        name: 'custom-object-approval',
        sourceDir: path.join('test', 'approval', 'sampleProjects', 'customObjects-and-children'),
      },
      devhubAuthStrategy: 'NONE',
    });
  });

  after(async () => {
    // await session?.clean();
  });

  describe('to source format', () => {
    before(async () => {
      // cs from the entire project
      const cs = await ComponentSetBuilder.build({
        sourcepath: [path.join(session.project.dir, 'originalMdapi')],
      });
      await converter.convert(cs, 'source', {
        type: 'directory',
        outputDirectory: path.join(session.project.dir, 'force-app'),
        genUniqueDir: false,
      });
      const dirEnts = await fs.promises.readdir(path.join(session.project.dir, 'force-app'), {
        recursive: true,
        withFileTypes: true,
      });

      createdSourceFiles = dirEnts.filter((file) => file.isFile()).map((file) => path.join(file.path, file.name));

      describe('files', () => {
        for (const file of createdSourceFiles) {
          it(`verify ${path.basename(file)}`, async () => {
            snap(await fs.promises.readFile(file, 'utf8'));
          });
        }
      });
    });

    it('Dummy test case, so "before" is executed', () => {});
  });

  describe('to mdapi format', () => {
    before(async () => {
      // cs from the entire project
      const cs = await ComponentSetBuilder.build({
        sourcepath: [path.join(session.project.dir, 'force-app')],
      });
      await converter.convert(cs, 'metadata', {
        type: 'directory',
        outputDirectory: path.join(session.project.dir, 'mdapiOutput'),
        genUniqueDir: false,
      });
      const dirEnts = await fs.promises.readdir(path.join(session.project.dir, 'mdapiOutput'), {
        recursive: true,
        withFileTypes: true,
      });

      createdSourceFiles = dirEnts.filter((file) => file.isFile()).map((file) => path.join(file.path, file.name));

      describe('files', () => {
        for (const file of createdSourceFiles) {
          it(`verify ${path.basename(file)}`, async () => {
            snap(await fs.promises.readFile(file, 'utf8'));
          });
        }
      });
    });

    it('Dummy test case, so "before" is executed', () => {});
  });
});
