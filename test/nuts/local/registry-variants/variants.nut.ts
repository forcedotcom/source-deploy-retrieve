/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { TestSession } from '@salesforce/cli-plugins-testkit';
import { expect, config, use } from 'chai';
import * as deepEqualInAnyOrder from 'deep-equal-in-any-order';
import { XMLParser } from 'fast-xml-parser';
import { ComponentSetBuilder, MetadataConverter } from '../../../../src';

config.truncateThreshold = 0;
use(deepEqualInAnyOrder);
describe('converts variants to and from mdapi', () => {
  let session: TestSession;

  before(async () => {
    session = await TestSession.create({
      project: {
        name: 'variantsNut',
        sourceDir: path.join('test', 'nuts', 'local', 'registry-variants', 'variantProj'),
      },
      devhubAuthStrategy: 'NONE',
    });
  });

  after(async () => {
    await session?.clean();
  });

  describe('mdapi to source format', () => {
    describe('permission set with no user permissions', () => {
      it('permission set', async () => {
        const converter = new MetadataConverter();
        const cs = await ComponentSetBuilder.build({
          sourcepath: [path.join(session.project.dir, 'mdapiInput', 'permissionSet')],
        });
        await converter.convert(cs, 'source', {
          type: 'directory',
          outputDirectory: path.join(session.project.dir, 'force-app'),
          genUniqueDir: false,
        });

        const permsetDir = path.join(
          session.project.dir,
          'force-app',
          'main',
          'default',
          'permissionsets',
          'dreamhouse'
        );
        const fileInfo = await fs.promises.readdir(permsetDir, { withFileTypes: true, recursive: true });
        expect(fileInfo.find((f) => f.name === 'dreamhouse.permissionset-meta.xml')).to.be.not.undefined;
        // file removes the decomposed things
        const mainFileContents = await fs.promises.readFile(
          path.join(permsetDir, 'dreamhouse.permissionset-meta.xml'),
          'utf-8'
        );
        expect(mainFileContents).to.include('<label>dreamhouse');
        expect(mainFileContents).to.not.include('objectPermissions');
        expect(mainFileContents).to.not.include('tabSettings');
        expect(fileInfo.find((f) => f.name === 'objectPermissions')?.isDirectory()).to.be.true;
        expect(fileInfo.find((f) => f.name === 'tabSettings')?.isDirectory()).to.be.true;
        const tabs = fileInfo.filter((f) => f.path.endsWith('tabSettings'));
        expect(tabs.length).to.equal(5);
        const fieldPermissions = fileInfo.filter((f) => f.path.endsWith('fieldPermissions'));
        expect(fieldPermissions).to.be.a('array').with.length(33);
        expect(fileInfo.find((f) => f.name === 'Broker__c.objectPermission-meta.xml')?.isFile()).to.be.true;
        expect(fileInfo.find((f) => f.name === 'Property__c.objectPermission-meta.xml')?.isFile()).to.be.true;
      });
    });
  });
  describe('decomposed source to mdapi', () => {
    it('permission set', async () => {
      const converter = new MetadataConverter();
      const cs = await ComponentSetBuilder.build({ sourcepath: [path.join(session.project.dir, 'force-app')] });
      await converter.convert(cs, 'metadata', {
        type: 'directory',
        outputDirectory: path.join(session.project.dir, 'mdapiOutput', 'permissionSet'),
        genUniqueDir: false,
      });
      // make some assertions about the decomposed permission set file structure
      const contents = await fs.promises.readFile(
        path.join(session.project.dir, 'mdapiOutput', 'permissionSet', 'permissionsets', 'dreamhouse.permissionset'),
        'utf8'
      );
      // round trip still parses the same
      expect(parser.parse(contents)).to.deep.equalInAnyOrder(
        parser.parse(
          await fs.promises.readFile(
            path.join(session.project.dir, 'mdapiInput', 'permissionSet', 'permissionsets', 'dreamhouse.permissionset'),
            'utf8'
          )
        )
      );
    });
  });
});

const parser = new XMLParser({
  ignoreAttributes: false,
  parseTagValue: false,
  parseAttributeValue: false,
  cdataPropName: '__cdata',
  ignoreDeclaration: true,
  numberParseOptions: { leadingZeros: false, hex: false },
});
