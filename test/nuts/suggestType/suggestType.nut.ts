/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'path';
import { TestSession } from '@salesforce/cli-plugins-testkit';
import { expect } from 'chai';
import { SfError } from '@salesforce/core';
import { ComponentSetBuilder } from '../../../src';

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

  it('it offers a suggestions on an invalid type', async () => {
    try {
      await ComponentSetBuilder.build({
        sourcepath: [path.join(session.project.dir, 'force-app', 'main', 'default', 'objects')],
      });
      throw new Error('This test should have thrown');
    } catch (err) {
      const error = err as SfError;
      expect(error.name).to.equal('TypeInferenceError');
      expect(error.actions).to.include(
        'A search for the ".objct-meta.xml" metadata suffix found the following close match:'
      );
      expect(error.actions).to.include(
        '- Did you mean ".object-meta.xml" instead for the "CustomObject" metadata type?'
      );
    }
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
        'A search for the ".Layout-meta.xml" metadata suffix found the following close match:'
      );
      expect(error.actions).to.include('- Did you mean ".layout-meta.xml" instead for the "Layout" metadata type?');
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
        'A search for the ".tabsss-meta.xml" metadata suffix found the following close matches:'
      );
      expect(error.actions).to.include(
        '- Did you mean ".labels-meta.xml" instead for the "CustomLabels" metadata type?'
      );
      expect(error.actions).to.include('- Did you mean ".tab-meta.xml" instead for the "CustomTab" metadata type?');
    }
  });

  it('it ignores package manifest files', async () => {
    const cs = await ComponentSetBuilder.build({ sourcepath: [path.join(session.project.dir, 'package-manifest')] });
    expect(cs['components'].size).to.equal(0);
  });
});
