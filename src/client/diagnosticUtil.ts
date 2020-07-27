/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { DeployMessage, ComponentDeployment, ComponentDiagnostic } from '../types/newClient';
import { registryData } from '../metadata-registry';
import { basename } from 'path';

export class DiagnosticUtil {
  private api: 'metadata' | 'tooling';

  constructor(api: 'metadata' | 'tooling') {
    this.api = api;
  }

  public setDiagnostic(
    componentDeployment: ComponentDeployment,
    message: string | DeployMessage
  ): ComponentDeployment {
    const { name: typeName } = componentDeployment.component.type;
    switch (typeName) {
      case registryData.types.lightningcomponentbundle.name:
        return this.parseLwc(componentDeployment, message);
      case registryData.types.auradefinitionbundle.name:
        return this.parseAura(componentDeployment, message);
      default:
        if (typeof message !== 'string') {
          return this.parseDefault(componentDeployment, message);
        }
    }
  }

  private parseLwc(
    componentDeployment: ComponentDeployment,
    message: string | DeployMessage
  ): ComponentDeployment {
    const problem = typeof message === 'string' ? message : message.problem;
    const diagnostic: ComponentDiagnostic = {
      message: problem,
      type: 'Error',
    };

    if (this.api === 'metadata') {
      const matches = problem.match(/(\[Line: (\d+), Col: (\d+)] )?(.*)/);
      if (matches && matches[2] && matches[3] && matches[4]) {
        diagnostic.lineNumber = Number(matches[2]);
        diagnostic.columnNumber = Number(matches[3]);
        diagnostic.message = matches[4];
        diagnostic.filePath = componentDeployment.component
          .walkContent()
          .find((f) => f.includes((message as DeployMessage).fileName));
      } else {
        diagnostic.message = problem;
      }
    } else {
      try {
        const pathParts = problem.split(/[\s\n\t]+/);
        const msgStartIndex = pathParts.findIndex((part) => part.includes(':'));
        const fileObject = pathParts[msgStartIndex];
        const errLocation = fileObject.slice(fileObject.indexOf(':') + 1);
        const fileName = fileObject.slice(0, fileObject.indexOf(':'));

        diagnostic.message = pathParts.slice(msgStartIndex + 2).join(' ');
        diagnostic.filePath = componentDeployment.component
          .walkContent()
          .find((f) => f.includes(fileName));
        diagnostic.lineNumber = Number(errLocation.split(',')[0]);
        diagnostic.columnNumber = Number(errLocation.split(',')[1]);
      } catch (e) {
        // TODO: log error with parsing error message
        diagnostic.message = problem;
      }
    }

    componentDeployment.diagnostics.push(diagnostic);
    return componentDeployment;
  }

  private parseAura(
    componentDeployment: ComponentDeployment,
    message: string | DeployMessage
  ): ComponentDeployment {
    const problem = typeof message === 'string' ? message : message.problem;
    const diagnostic: ComponentDiagnostic = {
      message: problem,
      type: 'Error',
    };

    const errLocation = problem.slice(problem.lastIndexOf('[') + 1, problem.lastIndexOf(']'));
    const errorParts = problem.split(' ');
    const fileType = errorParts.find((part) => {
      part = part.toLowerCase();
      return part.includes('controller') || part.includes('renderer') || part.includes('helper');
    });

    const filePath = fileType
      ? componentDeployment.component
          .walkContent()
          .find((s) => s.toLowerCase().includes(fileType.toLowerCase()))
      : undefined;
    const lineNumber = errLocation ? Number(errLocation.split(',')[0]) : undefined;
    const columnNumber = errLocation ? Number(errLocation.split(',')[1]) : undefined;
    if (filePath && lineNumber && columnNumber) {
      diagnostic.lineNumber = lineNumber;
      diagnostic.columnNumber = columnNumber;
      diagnostic.filePath = filePath;
    }

    diagnostic.message = problem;
    componentDeployment.diagnostics.push(diagnostic);

    return componentDeployment;
  }

  private parseDefault(
    componentDeployment: ComponentDeployment,
    message: DeployMessage
  ): ComponentDeployment {
    const diagnostic: ComponentDiagnostic = {
      message: message.problem,
      type: message.problemType,
    };
    if (message.fileName) {
      const localProblemFile = componentDeployment.component
        .walkContent()
        .find((f) => f.endsWith(basename(message.fileName)));
      diagnostic.filePath = localProblemFile;
    }
    if (message.lineNumber && message.columnNumber) {
      diagnostic.lineNumber = Number(message.lineNumber);
      diagnostic.columnNumber = Number(message.columnNumber);
    }
    componentDeployment.diagnostics.push(diagnostic);
    return componentDeployment;
  }
}
