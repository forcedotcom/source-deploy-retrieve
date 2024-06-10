/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { basename } from 'node:path';
import { SfError } from '@salesforce/core';
import { SourceComponent } from '../resolve/sourceComponent';
import { registry } from '../registry/registry';
import { ComponentDiagnostic, DeployMessage } from './types';

type RelevantMessageProps = Pick<DeployMessage, 'problem' | 'problemType' | 'fileName' | 'lineNumber' | 'columnNumber'>;

export const parseDeployDiagnostic = (
  component: SourceComponent,
  message: string | RelevantMessageProps
): ComponentDiagnostic => {
  const { name: typeName } = component.type;
  const problem = getProblemFromMessage(message, component);

  switch (typeName) {
    case registry.types.lightningcomponentbundle.name:
      return parseLwc(component, message, problem);
    case registry.types.auradefinitionbundle.name:
      return parseAura(component, message, problem);
    default:
      if (typeof message !== 'string') {
        return parseDefault(component, message, problem);
      }
      throw new SfError(
        `Unable to parse deploy diagnostic with string message: ${message} for component ${component.fullName}`
      );
  }
};

const parseLwc = (
  component: SourceComponent,
  message: string | RelevantMessageProps,
  problem: string
): ComponentDiagnostic => {
  const filePath = messageHasProblemAndFilename(message) ? getFileEndingWith(message.fileName)(component) : undefined;
  const [line, col, lwcError] = (new RegExp(/(\[Line: (\d+), Col: (\d+)] )?(.*)/).exec(problem) ?? []).slice(2, 5);
  const [lineNumber, columnNumber] = [line, col].map(Number);
  return {
    problemType: 'Error',
    ...(filePath ? { filePath } : {}),
    ...(lineNumber && columnNumber && lwcError
      ? { lineNumber, columnNumber, error: appendErrorWithLocation(lwcError, lineNumber, columnNumber) }
      : { error: problem }),
  };
};

const parseAura = (
  component: SourceComponent,
  message: string | RelevantMessageProps,
  problem: string
): ComponentDiagnostic => {
  const filePath = messageHasProblemAndFilename(message) ? getFileEndingWith(message.fileName)(component) : undefined;
  const [lineNumber, columnNumber] = (new RegExp(/(\d+),\s?(\d+)/).exec(problem) ?? []).slice(1, 3).map(Number);
  return {
    problemType: 'Error',
    ...(filePath ? { filePath } : {}),
    ...(lineNumber >= 0 && columnNumber >= 0
      ? { lineNumber, columnNumber, error: appendErrorWithLocation(problem, lineNumber, columnNumber) }
      : { error: problem }),
  };
};

const parseDefault = (
  component: SourceComponent,
  message: RelevantMessageProps,
  problem: string
): ComponentDiagnostic => {
  const { problemType, fileName, lineNumber, columnNumber } = message;

  return {
    problemType: problemType ?? 'Error',
    ...(fileName ? { filePath: getFileEndingWith(fileName)(component) } : {}),
    ...(lineNumber && columnNumber
      ? {
          lineNumber: Number(lineNumber),
          columnNumber: Number(columnNumber),
          error: appendErrorWithLocation(problem, lineNumber, columnNumber),
        }
      : { error: problem }),
  };
};

const appendErrorWithLocation = (error: string, line: string | number, column: string | number): string =>
  `${error} (${line}:${column})`;

const messageHasProblemAndFilename = (
  message: string | RelevantMessageProps
): message is DeployMessage & Pick<DeployMessage, 'fileName' | 'problem'> =>
  typeof message === 'object' && 'problem' in message && 'fileName' in message;

const getFileEndingWith =
  (fileName: string) =>
  (component: SourceComponent): string | undefined =>
    component.walkContent().find(endsWith(basename(fileName))) ?? component.xml;

const endsWith =
  (ending: string) =>
  (f: string): boolean =>
    f.endsWith(ending);

const getProblemFromMessage = (message: string | RelevantMessageProps, component: SourceComponent): string => {
  const problem = typeof message === 'string' ? message : message.problem;
  if (!problem) {
    throw new SfError(
      `Unable to parse deploy diagnostic with empty problem: ${JSON.stringify(message)} for component ${
        component.fullName
      }`
    );
  }
  return problem;
};
