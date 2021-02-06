/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { DiagnosticUtil } from '../../src/client/diagnosticUtil';
import { ComponentProperties, SourceComponent } from '../../src/metadata-registry/sourceComponent';
import { registryData, VirtualTreeContainer } from '../../src/metadata-registry';
import { join } from 'path';
import { expect } from 'chai';
import {
  ComponentDeployment,
  ComponentStatus,
  DeployMessage,
  RequestStatus,
} from '../../src/client/types';
import { TreeContainer } from '../../src';

function createDeployment(props: ComponentProperties, tree?: TreeContainer): ComponentDeployment {
  return {
    status: ComponentStatus.Failed,
    component: new SourceComponent(props, tree),
    diagnostics: [],
  };
}

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
    const component = {
      name: 'Test',
      type: registryData.types.apexclass,
      content: join(classes, 'Test.cls'),
      xml: join(classes, 'Test.cls-meta.xml'),
    };
    const tree = new VirtualTreeContainer([
      {
        dirPath: classes,
        children: ['Test.cls', 'Test.cls-meta.xml'],
      },
    ]);

    it('should create diagnostic for problem with message only', () => {
      const deployment = createDeployment(component, tree);
      const message = createDeployMessage({
        problem: 'This might be a problem later!',
        problemType: 'Warning',
      });
      expect(util.setDeployDiagnostic(deployment, message).diagnostics).to.deep.equal([
        {
          message: 'This might be a problem later!',
          type: 'Warning',
        },
      ]);
    });

    it('should create diagnostic for problem with file line and column info', () => {
      const deployment = createDeployment(component, tree);
      const message = createDeployMessage({
        problem: 'Expected a ;',
        problemType: 'Error',
        fileName: 'Test.cls',
        lineNumber: '4',
        columnNumber: '2',
      });
      expect(util.setDeployDiagnostic(deployment, message).diagnostics).to.deep.equal([
        {
          message: 'Expected a ;',
          type: 'Error',
          filePath: component.content,
          lineNumber: 4,
          columnNumber: 2,
        },
      ]);
    });
  });

  describe('Retrieve', () => {
    const util = new DiagnosticUtil('metadata');
    const classes = join('path', 'to', 'classes');
    const props = {
      name: 'Test',
      type: registryData.types.apexclass,
      content: join(classes, 'Test.cls'),
      xml: join(classes, 'Test.cls-meta.xml'),
    };
    const component = SourceComponent.createVirtualComponent(props, [
      {
        dirPath: classes,
        children: ['Test.cls', 'Test.cls-meta.xml'],
      },
    ]);

    it('should create retrieve diagnostic for componentRetrieval', () => {
      const message = 'There was a problem with the retrieve';
      expect(
        util.setRetrieveDiagnostic(message, { component, status: RequestStatus.Failed })
      ).to.deep.equal({
        diagnostics: {
          message,
          type: 'Error',
          filePath: component.content,
        },
        component,
        status: RequestStatus.Failed,
      });
    });
  });

  describe('LWC Deploy', () => {
    const bundlePath = join('path', 'to', 'lwc', 'test');
    const component = {
      name: 'Test',
      type: registryData.types.lightningcomponentbundle,
      xml: join(bundlePath, 'test.js-meta.xml'),
      content: bundlePath,
    };
    const tree = new VirtualTreeContainer([
      {
        dirPath: bundlePath,
        children: ['test.js-meta.xml', 'test.js', 'test.html'],
      },
    ]);

    it('should create diagnostic for problem with message only using tooling api', () => {
      const util = new DiagnosticUtil('tooling');
      const deployment = createDeployment(component, tree);
      const message = 'There was a problem with the component';
      expect(util.setDeployDiagnostic(deployment, message).diagnostics).to.deep.equal([
        {
          message,
          type: 'Error',
        },
      ]);
    });

    it('should create diagnostic for problem with file line and column info using tooling api', () => {
      const util = new DiagnosticUtil('tooling');
      const deployment = createDeployment(component, tree);
      const message = 'Compilation Failure\n\ttest.html:3,12 : LWC1075: Multiple roots found';
      expect(util.setDeployDiagnostic(deployment, message).diagnostics).to.deep.equal([
        {
          message: 'LWC1075: Multiple roots found',
          type: 'Error',
          filePath: join(bundlePath, 'test.html'),
          lineNumber: 3,
          columnNumber: 12,
        },
      ]);
    });

    it('should create diagnostic for problem with message only using metadata api', () => {
      const util = new DiagnosticUtil('metadata');
      const deployment = createDeployment(component, tree);
      const message = createDeployMessage({
        problem: 'There was a problem deploying',
        problemType: 'Error',
      });
      expect(util.setDeployDiagnostic(deployment, message).diagnostics).to.deep.equal([
        {
          message: message.problem,
          type: message.problemType,
        },
      ]);
    });

    it('should create diagnostic for problem with file line and column info using metadata api', () => {
      const util = new DiagnosticUtil('metadata');
      const deployment = createDeployment(component, tree);
      const message = createDeployMessage({
        problem: '[Line: 4, Col: 15] LWC1075: Multiple roots found',
        problemType: 'Error',
        fileName: join('test', 'test.html'),
      });
      expect(util.setDeployDiagnostic(deployment, message).diagnostics).to.deep.equal([
        {
          message: 'LWC1075: Multiple roots found',
          type: 'Error',
          filePath: join(bundlePath, 'test.html'),
          lineNumber: 4,
          columnNumber: 15,
        },
      ]);
    });
  });

  describe('Aura Deploy', () => {
    const bundlePath = join('path', 'to', 'aura', 'test');
    const component = {
      name: 'Test',
      type: registryData.types.auradefinitionbundle,
      xml: join(bundlePath, 'test.app-meta.xml'),
      content: bundlePath,
    };
    const tree = new VirtualTreeContainer([
      {
        dirPath: bundlePath,
        children: ['test.app-meta.xml', 'test.app', 'testHelper.js', 'TestApp.auradoc'],
      },
    ]);

    it('should create diagnostic for problem with message only using metadata api', () => {
      const util = new DiagnosticUtil('metadata');
      const deployment = createDeployment(component, tree);
      const message = createDeployMessage({
        problem: 'There was a problem deploying',
        problemType: 'Error',
      });
      expect(util.setDeployDiagnostic(deployment, message).diagnostics).to.deep.equal([
        {
          message: message.problem,
          type: message.problemType,
        },
      ]);
    });

    it('should create diagnostic for problem with file line and column info using metadata api', () => {
      const util = new DiagnosticUtil('metadata');
      const deployment = createDeployment(component, tree);
      const message = createDeployMessage({
        problem: '[row,col]:[1,5]\nMessage: There was a typo',
        problemType: 'Error',
        fileName: join('test', 'testHelper.js'),
      });
      expect(util.setDeployDiagnostic(deployment, message).diagnostics).to.deep.equal([
        {
          message: message.problem,
          type: 'Error',
          filePath: join(bundlePath, 'testHelper.js'),
          lineNumber: 1,
          columnNumber: 5,
        },
      ]);
    });

    it('should create diagnostic for problem with message only using tooling api', () => {
      const util = new DiagnosticUtil('tooling');
      const deployment = createDeployment(component, tree);
      const message = 'There was a problem deploying';
      expect(util.setDeployDiagnostic(deployment, message).diagnostics).to.deep.equal([
        {
          message,
          type: 'Error',
        },
      ]);
    });

    it('should create diagnostic for problem with file line and column info using tooling api', () => {
      const util = new DiagnosticUtil('tooling');
      const deployment = createDeployment(component, tree);
      const message = createDeployMessage({
        problem:
          "c.TestApp: Failed to parse HELPER for js://c.TestApp: Expected ',' or '}' [5, 1]: 's'",
        problemType: 'Error',
        fileName: join('test', 'testHelper.js'),
      });
      expect(util.setDeployDiagnostic(deployment, message).diagnostics).to.deep.equal([
        {
          message: message.problem,
          type: 'Error',
          filePath: join(bundlePath, 'testHelper.js'),
          lineNumber: 5,
          columnNumber: 1,
        },
      ]);
    });
  });
});
