/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { SourcePath } from '../common';
import { registryData, SourceComponent } from '../metadata-registry';
import { basename } from 'path';
import { DeployMessage, ComponentDiagnostic } from './types';

export class DiagnosticUtil {
  private api: 'metadata' | 'tooling';

  constructor(api: 'metadata' | 'tooling') {
    this.api = api;
  }

  public parseDeployDiagnostic(
    component: SourceComponent,
    message: string | DeployMessage
  ): ComponentDiagnostic {
    const { name: typeName } = component.type;
    switch (typeName) {
      case registryData.types.lightningcomponentbundle.name:
        return this.parseLwc(component, message);
      case registryData.types.auradefinitionbundle.name:
        return this.parseAura(component, message);
      default:
        if (typeof message !== 'string') {
          return this.parseDefault(component, message);
        }
    }
  }

  private parseDefault(component: SourceComponent, message: DeployMessage): ComponentDiagnostic {
    const { problem, problemType, fileName, lineNumber, columnNumber } = message;
    const diagnostic: ComponentDiagnostic = {
      error: problem,
      problemType,
    };

    if (fileName) {
      const localProblemFile = component
        .walkContent()
        .find((f) => f.endsWith(basename(message.fileName)));
      diagnostic.filePath = localProblemFile ?? component.xml;
    }

    if (lineNumber && columnNumber) {
      diagnostic.lineNumber = Number(lineNumber);
      diagnostic.columnNumber = Number(columnNumber);
      diagnostic.error = this.appendErrorWithLocation(diagnostic.error, lineNumber, columnNumber);
    }

    return diagnostic;
  }

  private parseLwc(
    component: SourceComponent,
    message: string | DeployMessage
  ): ComponentDiagnostic {
    const problem = typeof message === 'string' ? message : message.problem;
    const diagnostic: ComponentDiagnostic = {
      error: problem,
      problemType: 'Error',
    };

    if (this.api === 'metadata') {
      const deployMessage = message as DeployMessage;
      if (deployMessage.fileName) {
        diagnostic.filePath = component
          .walkContent()
          .find((f) => f.includes((message as DeployMessage).fileName));
      }
      const matches = problem.match(/(\[Line: (\d+), Col: (\d+)] )?(.*)/);
      if (matches && matches[2] && matches[3] && matches[4]) {
        diagnostic.lineNumber = Number(matches[2]);
        diagnostic.columnNumber = Number(matches[3]);
        diagnostic.error = this.appendErrorWithLocation(
          matches[4],
          diagnostic.lineNumber,
          diagnostic.columnNumber
        );
      } else {
        diagnostic.error = problem;
      }
    } else {
      try {
        const pathParts = problem.split(/[\s\n\t]+/);
        const msgStartIndex = pathParts.findIndex((part) => part.includes(':'));
        const fileObject = pathParts[msgStartIndex];
        const errLocation = fileObject.slice(fileObject.indexOf(':') + 1);
        const fileName = fileObject.slice(0, fileObject.indexOf(':'));

        diagnostic.error = pathParts.slice(msgStartIndex + 2).join(' ');
        diagnostic.filePath = component.walkContent().find((f) => f.includes(fileName));
        diagnostic.lineNumber = Number(errLocation.split(',')[0]);
        diagnostic.columnNumber = Number(errLocation.split(',')[1]);
        diagnostic.error = this.appendErrorWithLocation(
          diagnostic.error,
          diagnostic.lineNumber,
          diagnostic.columnNumber
        );
      } catch (e) {
        // TODO: log error with parsing error message
        diagnostic.error = problem;
      }
    }

    return diagnostic;
  }

  private parseAura(
    component: SourceComponent,
    message: string | DeployMessage
  ): ComponentDiagnostic {
    const problem = typeof message === 'string' ? message : message.problem;
    const diagnostic: ComponentDiagnostic = {
      error: problem,
      problemType: 'Error',
    };

    let filePath: SourcePath;
    if (this.api === 'tooling') {
      const errorParts = problem.split(' ');
      const fileType = errorParts.find((part) => {
        part = part.toLowerCase();
        return part.includes('controller') || part.includes('renderer') || part.includes('helper');
      });

      filePath = fileType
        ? component.walkContent().find((s) => s.toLowerCase().includes(fileType.toLowerCase()))
        : undefined;
    } else {
      const deployMessage = message as DeployMessage;
      if (deployMessage.fileName) {
        filePath = component
          .walkContent()
          .find((f) => f.endsWith(basename(deployMessage.fileName)));
      }
    }

    if (filePath) {
      diagnostic.filePath = filePath;
      const matches = problem.match(/(\d+),\s?(\d+)/);
      if (matches) {
        const lineNumber = Number(matches[1]);
        const columnNumber = Number(matches[2]);
        diagnostic.lineNumber = lineNumber;
        diagnostic.columnNumber = columnNumber;
        diagnostic.error = this.appendErrorWithLocation(diagnostic.error, lineNumber, columnNumber);
      }
    }

    return diagnostic;
  }

  private appendErrorWithLocation(
    error: string,
    line: string | number,
    column: string | number
  ): string {
    return `${error} (${line}:${column})`;
  }
}
