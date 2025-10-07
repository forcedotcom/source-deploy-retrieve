/*
 * Copyright 2025, Salesforce, Inc.
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
import { join } from 'node:path';
import { assert, expect, config } from 'chai';
import { SfError } from '@salesforce/core';
import { parseDeployDiagnostic } from '../../src/client/diagnosticUtil';
import { DeployMessage, registry, SourceComponent } from '../../src';

config.truncateThreshold = 0;

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
      const diagnostic = parseDeployDiagnostic(component, message);
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
        parseDeployDiagnostic(component, message);
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

      const diagnostic = parseDeployDiagnostic(component, message);

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

    it('should create diagnostic for problem with message only using metadata api', () => {
      const error = 'There was a problem with the component';
      const diagnostic = parseDeployDiagnostic(component, error);
      expect(diagnostic).to.deep.equal({ error, problemType: 'Error' });
    });

    it('should create diagnostic for problem with message only using metadata api', () => {
      const message = createDeployMessage({
        problem: 'There was a problem deploying',
        problemType: 'Error',
      });

      const diagnostic = parseDeployDiagnostic(component, message);

      expect(diagnostic).to.deep.equal({
        error: message.problem,
        problemType: message.problemType,
      });
    });

    it('should create diagnostic for problem with file line and column info using metadata api', () => {
      const message = createDeployMessage({
        problem: '[Line: 4, Col: 15] LWC1075: Multiple roots found',
        problemType: 'Error',
        fileName: join('test', 'test.html'),
      });

      const diagnostic = parseDeployDiagnostic(component, message);

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
      const message = createDeployMessage({
        problem: 'There was a problem deploying',
        problemType: 'Error',
      });

      const diagnostic = parseDeployDiagnostic(component, message);

      expect(diagnostic).to.deep.equal({
        error: message.problem,
        problemType: message.problemType,
      });
    });

    it('should create diagnostic for problem with file line and column info using metadata api', () => {
      const message = createDeployMessage({
        problem: '[row,col]:[1,5]\nMessage: There was a typo',
        problemType: 'Error',
        fileName: join('test', 'testHelper.js'),
      });

      const diagnostic = parseDeployDiagnostic(component, message);

      expect(diagnostic).to.deep.equal({
        error: `${message.problem} (1:5)`,
        problemType: 'Error',
        filePath: join(bundlePath, 'testHelper.js'),
        lineNumber: 1,
        columnNumber: 5,
      });
    });
  });
});
