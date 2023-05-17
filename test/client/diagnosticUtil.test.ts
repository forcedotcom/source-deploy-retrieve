/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { join } from 'path';
import { assert, expect } from 'chai';
import { SfError } from '@salesforce/core';
import { DiagnosticUtil } from '../../src/client/diagnosticUtil';
import { DeployMessage, registry, SourceComponent } from '../../src';

type MockDeployMessage = {
  problem?: string;
  problemType?: string;
  lineNumber?: string;
  columnNumber?: string;
  fileName?: string;
};

function createDeployMessage(props: MockDeployMessage): DeployMessage {
  // @ts-ignore trading a bunch of ts-ignores for one ts-ignore
  return props;
}

describe('DiagnosticUtil', () => {
  describe('Default Deploy', () => {
    const util = new DiagnosticUtil('metadata');
    const classes = join('path', 'to', 'classes');
    const component = SourceComponent.createVirtualComponent(
      {
        name: 'Test',
        type: registry.types.apexclass,
        content: join(classes, 'Test.cls'),
        xml: join(classes, 'Test.cls-meta.xml'),
      },
      [
        {
          dirPath: classes,
          children: ['Test.cls', 'Test.cls-meta.xml'],
        },
      ]
    );

    it('should create diagnostic for problem with message only', () => {
      const message = createDeployMessage({
        problem: 'This might be a problem later!',
        problemType: 'Warning',
      });
      const diagnostic = util.parseDeployDiagnostic(component, message);
      expect(diagnostic).to.deep.equal({
        error: 'This might be a problem later!',
        problemType: 'Warning',
      });
    });

    it('should throw friendly error for message with missing problem', () => {
      const message = createDeployMessage({
        problemType: 'Warning',
      });
      try {
        util.parseDeployDiagnostic(component, message);
      } catch (e) {
        assert(e instanceof SfError);
        expect(e.message).to.include('Unable to parse deploy diagnostic with empty problem');
        expect(e.message).to.include(JSON.stringify(message));
      }
    });

    it('should create diagnostic for problem with file line and column info', () => {
      const message = createDeployMessage({
        problem: 'Expected a ;',
        problemType: 'Error',
        fileName: 'Test.cls',
        lineNumber: '4',
        columnNumber: '2',
      });

      const diagnostic = util.parseDeployDiagnostic(component, message);

      expect(diagnostic).to.deep.equal({
        error: 'Expected a ; (4:2)',
        problemType: 'Error',
        filePath: component.content,
        lineNumber: 4,
        columnNumber: 2,
      });
    });
  });

  describe('LWC Deploy', () => {
    const bundlePath = join('path', 'to', 'lwc', 'test');
    const component = SourceComponent.createVirtualComponent(
      {
        name: 'Test',
        type: registry.types.lightningcomponentbundle,
        xml: join(bundlePath, 'test.js-meta.xml'),
        content: bundlePath,
      },
      [
        {
          dirPath: bundlePath,
          children: ['test.js-meta.xml', 'test.js', 'test.html'],
        },
      ]
    );

    it('should create diagnostic for problem with message only using tooling api', () => {
      const util = new DiagnosticUtil('tooling');
      const error = 'There was a problem with the component';

      const diagnostic = util.parseDeployDiagnostic(component, error);

      expect(diagnostic).to.deep.equal({ error, problemType: 'Error' });
    });

    it('should create diagnostic for problem with file line and column info using tooling api', () => {
      const util = new DiagnosticUtil('tooling');
      const error = 'Compilation Failure\n\ttest.html:3,12 : LWC1075: Multiple roots found';

      const diagnostic = util.parseDeployDiagnostic(component, error);

      expect(diagnostic).to.deep.equal({
        error: 'LWC1075: Multiple roots found (3:12)',
        problemType: 'Error',
        filePath: join(bundlePath, 'test.html'),
        lineNumber: 3,
        columnNumber: 12,
      });
    });

    it('should create diagnostic for problem with message only using metadata api', () => {
      const util = new DiagnosticUtil('metadata');
      const message = createDeployMessage({
        problem: 'There was a problem deploying',
        problemType: 'Error',
      });

      const diagnostic = util.parseDeployDiagnostic(component, message);

      expect(diagnostic).to.deep.equal({
        error: message.problem,
        problemType: message.problemType,
      });
    });

    it('should create diagnostic for problem with file line and column info using metadata api', () => {
      const util = new DiagnosticUtil('metadata');
      const message = createDeployMessage({
        problem: '[Line: 4, Col: 15] LWC1075: Multiple roots found',
        problemType: 'Error',
        fileName: join('test', 'test.html'),
      });

      const diagnostic = util.parseDeployDiagnostic(component, message);

      expect(diagnostic).to.deep.equal({
        error: 'LWC1075: Multiple roots found (4:15)',
        problemType: 'Error',
        filePath: join(bundlePath, 'test.html'),
        lineNumber: 4,
        columnNumber: 15,
      });
    });
  });

  describe('Aura Deploy', () => {
    const bundlePath = join('path', 'to', 'aura', 'test');
    const component = SourceComponent.createVirtualComponent(
      {
        name: 'Test',
        type: registry.types.auradefinitionbundle,
        xml: join(bundlePath, 'test.app-meta.xml'),
        content: bundlePath,
      },
      [
        {
          dirPath: bundlePath,
          children: ['test.app-meta.xml', 'test.app', 'testHelper.js', 'TestApp.auradoc'],
        },
      ]
    );

    it('should create diagnostic for problem with message only using metadata api', () => {
      const util = new DiagnosticUtil('metadata');
      const message = createDeployMessage({
        problem: 'There was a problem deploying',
        problemType: 'Error',
      });

      const diagnostic = util.parseDeployDiagnostic(component, message);

      expect(diagnostic).to.deep.equal({
        error: message.problem,
        problemType: message.problemType,
      });
    });

    it('should create diagnostic for problem with file line and column info using metadata api', () => {
      const util = new DiagnosticUtil('metadata');
      const message = createDeployMessage({
        problem: '[row,col]:[1,5]\nMessage: There was a typo',
        problemType: 'Error',
        fileName: join('test', 'testHelper.js'),
      });

      const diagnostic = util.parseDeployDiagnostic(component, message);

      expect(diagnostic).to.deep.equal({
        error: `${message.problem} (1:5)`,
        problemType: 'Error',
        filePath: join(bundlePath, 'testHelper.js'),
        lineNumber: 1,
        columnNumber: 5,
      });
    });

    it('should create diagnostic for problem with message only using tooling api', () => {
      const util = new DiagnosticUtil('tooling');
      const error = 'There was a problem deploying';

      const diagnostic = util.parseDeployDiagnostic(component, error);

      expect(diagnostic).to.deep.equal({
        error,
        problemType: 'Error',
      });
    });

    it('should create diagnostic for problem with file line and column info using tooling api', () => {
      const util = new DiagnosticUtil('tooling');
      const message = createDeployMessage({
        problem: "c.TestApp: Failed to parse HELPER for js://c.TestApp: Expected ',' or '}' [5, 1]: 's'",
        problemType: 'Error',
        fileName: join('test', 'testHelper.js'),
      });

      const diagnostic = util.parseDeployDiagnostic(component, message);

      expect(diagnostic).to.deep.equal({
        error: `${message.problem} (5:1)`,
        problemType: 'Error',
        filePath: join(bundlePath, 'testHelper.js'),
        lineNumber: 5,
        columnNumber: 1,
      });
    });
  });
});
