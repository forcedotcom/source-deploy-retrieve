/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'node:path';
import * as fs from 'node:fs';
import { join } from 'node:path';
import { TestSession } from '@salesforce/cli-plugins-testkit';
import { expect, config } from 'chai';
import { SfError, Messages, Lifecycle } from '@salesforce/core';
import * as sinon from 'sinon';
import { ComponentSetBuilder, MetadataConverter } from '../../../src';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/source-deploy-retrieve', 'sdr');

config.truncateThreshold = 0;

describe('suggest types', () => {
  let session: TestSession;

  before(async () => {
    session = await TestSession.create({
      project: {
        sourceDir: path.join('test', 'nuts', 'suggestType', 'testProj'),
      },
      devhubAuthStrategy: 'NONE',
    });
  });

  after(async () => {
    await session?.clean();
  });

  it('it offers a suggestions on an invalid metadata suffix', async () => {
    try {
      await ComponentSetBuilder.build({
        sourcepath: [path.join(session.project.dir, 'force-app', 'main', 'default', 'objects')],
      });
      throw new Error('This test should have thrown');
    } catch (err) {
      const error = err as SfError;
      expect(error.name).to.equal('TypeInferenceError');
      expect(error.actions).to.include(
        'A metadata type lookup for "MyTestObject__c.objct-meta.xml" found the following close matches:'
      );
      expect(error.actions).to.include(
        '-- Did you mean ".object-meta.xml" instead for the "CustomObject" metadata type?'
      );
    }
  });

  it('it offers a suggestions on an invalid filename suffix', async () => {
    try {
      await ComponentSetBuilder.build({
        sourcepath: [path.join(session.project.dir, 'force-app', 'main', 'default', 'classes', 'DummyClass.clss')],
      });
      throw new Error('This test should have thrown');
    } catch (err) {
      const error = err as SfError;
      expect(error.name).to.equal('TypeInferenceError');
      expect(error.actions).to.include(
        'A metadata type lookup for "DummyClass.clss" found the following close matches:'
      );
      expect(error.actions).to.include('-- Did you mean ".cls" instead for the "ApexClass" metadata type?');
    }
  });

  it('it offers a suggestions on metadata format file when converting to metadata', async () => {
    const lifecycleSpy = sinon.spy(Lifecycle.prototype, 'emitWarning');

    const set = await ComponentSetBuilder.build({
      sourcepath: [
        path.join(
          session.project.dir,
          'force-app',
          'main',
          'default',
          'enablementMeasureDefinitions',
          'measure.enablementMeasureDefinition'
        ),
      ],
    });
    const converter = new MetadataConverter();
    await converter.convert(set, 'metadata', {
      type: 'directory',
      genUniqueDir: false,
      outputDirectory: 'output',
    });
    expect(lifecycleSpy.args.flat()).to.deep.include([
      `Found a file (${join(
        'enablementMeasureDefinitions',
        'measure.enablementMeasureDefinition'
      )}) that appears to be in metadata format, but the directory it's in is for source formatted files.`,
    ]);

    fs.rmSync('output', { recursive: true, force: true });
  });

  it('it offers a suggestions on a incorrect casing', async () => {
    try {
      await ComponentSetBuilder.build({
        sourcepath: [path.join(session.project.dir, 'force-app', 'main', 'default', 'layouts')],
      });
      throw new Error('This test should have thrown');
    } catch (err) {
      const error = err as SfError;
      expect(error.name).to.equal('TypeInferenceError');
      expect(error.actions).to.include(
        'A metadata type lookup for "MyTestObject__c-MyTestObject Layout.Layout-meta.xml" found the following close matches:'
      );
      expect(error.actions).to.include('-- Did you mean ".layout-meta.xml" instead for the "Layout" metadata type?');
    }
  });

  it('it offers multiple suggestions if Levenshtein distance is the same', async () => {
    try {
      await ComponentSetBuilder.build({
        sourcepath: [path.join(session.project.dir, 'force-app', 'main', 'default', 'tabs')],
      });
      throw new Error('This test should have thrown');
    } catch (err) {
      const error = err as SfError;
      expect(error.name).to.equal('TypeInferenceError');
      expect(error.actions).to.include(
        'A metadata type lookup for "Settings.tabsss-meta.xml" found the following close matches:'
      );
      expect(error.actions).to.include(
        '-- Did you mean ".labels-meta.xml" instead for the "CustomLabels" metadata type?'
      );
      expect(error.actions).to.include('-- Did you mean ".tab-meta.xml" instead for the "CustomTab" metadata type?');
    }
  });

  it('it offers additional suggestions to try', async () => {
    try {
      await ComponentSetBuilder.build({
        sourcepath: [path.join(session.project.dir, 'force-app', 'main', 'default', 'tabs')],
      });
      throw new Error('This test should have thrown');
    } catch (err) {
      const error = err as SfError;
      expect(error.name).to.equal('TypeInferenceError');
      expect(error.actions).to.include(messages.getMessage('suggest_type_more_suggestions'));
    }
  });

  // Since EmailServicesFunction uses the 'xml' suffix, we want to ensure it still resolves correctly
  it('it still correctly resolves an EmailServicesFunction', async () => {
    const cs = await ComponentSetBuilder.build({
      sourcepath: [path.join(session.project.dir, 'force-app', 'main', 'default', 'emailservices')],
    });
    expect(cs['components'].size).to.equal(1);
    expect((await cs.getObject()).Package.types[0].name).to.equal('EmailServicesFunction');
  });

  // This uses the closeMetaSuffix lookup
  it('it errors on very incorrectly named metadata', async () => {
    try {
      await ComponentSetBuilder.build({
        sourcepath: [path.join(session.project.dir, 'force-app', 'main', 'default', 'labels')],
      });
      throw new Error('This test should have thrown');
    } catch (err) {
      const error = err as SfError;
      expect(error.name).to.equal('TypeInferenceError');
      expect(error.actions).to.include(
        'A metadata type lookup for "CustomLabels.labels.xml" found the following close matches:'
      );
      expect(error.actions).to.include(
        '-- Did you mean ".labels-meta.xml" instead for the "CustomLabels" metadata type?'
      );
    }
  });

  it('it ignores package manifest files with default name', async () => {
    const cs = await ComponentSetBuilder.build({ sourcepath: [path.join(session.project.dir, 'package-manifest')] });
    expect(cs['components'].size).to.equal(0);
  });

  it('it ignores package manifest files with non-default name', async () => {
    const cs = await ComponentSetBuilder.build({ sourcepath: [path.join(session.project.dir, 'package-manifest-2')] });
    expect(cs['components'].size).to.equal(0);
  });
});
