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

import { basename, dirname, extname, join, posix, sep } from 'node:path';
import { SfError } from '@salesforce/core/sfError';
import { ensureArray } from '@salesforce/kit';
import { SourceComponentWithContent, SourceComponent } from '../resolve/sourceComponent';
import { ComponentLike } from '../resolve';
import { registry } from '../registry/registry';
import {
  BooleanString,
  ComponentStatus,
  DeployMessage,
  FileResponse,
  FileResponseFailure,
  FileResponseSuccess,
  MetadataApiDeployStatus,
} from './types';
import { parseDeployDiagnostic } from './diagnosticUtil';
import { isWebAppBundle } from './utils';

type DeployMessageWithComponentType = DeployMessage & { componentType: string };
/**
 * Fix any issues with the deploy message returned by the api.
 * TODO: remove cases if fixes are made in the api.
 */
export const sanitizeDeployMessage = (message: DeployMessage): DeployMessageWithComponentType => {
  if (!hasComponentType(message)) {
    throw new SfError(`Missing componentType in deploy message ${message.fullName} ${message.fileName}`);
  }

  // mdapi error messages have the type as "FooSettings" but SDR only recognizes "Settings"
  if (message.componentType.endsWith('Settings') && message.fileName.endsWith('.settings')) {
    return {
      ...message,
      componentType: 'Settings',
    };
  }
  if (message.componentType === registry.types.lightningcomponentbundle.name) {
    return {
      ...message,
      fullName: message.fullName.replace(/markup:\/\/[a-z|0-9|_]+:/i, ''),
    };
  }
  if (message.componentType === registry.types.document.name) {
    return {
      ...message,
      // strip document extension from fullName
      fullName: join(dirname(message.fullName), basename(message.fullName, extname(message.fullName))),
    };
  }
  // Treat emailTemplateFolder as EmailFolder
  if (message.componentType === registry.types.emailtemplatefolder.name) {
    return {
      ...message,
      // strip document extension from fullName
      componentType: registry.types.emailfolder.name,
    };
  }
  return message;
};

// components with children are already taken care of through the messages, so don't walk their content directories.
const shouldWalkContent = (component: SourceComponent): boolean =>
  typeof component.content === 'string' &&
  (!component.type.children ||
    Object.values(component.type.children.types).some(
      (t) => t.unaddressableWithoutParent === true || t.isAddressable === false
    ));

export const createResponses =
  (projectPath?: string) =>
  (component: SourceComponent, responseMessages: DeployMessage[]): FileResponse[] =>
    responseMessages.flatMap((message): FileResponse[] => {
      const state = getState(message);
      const base = { fullName: component.fullName, type: component.type.name } as const;

      if (state === ComponentStatus.Failed) {
        return [{ ...base, state, ...parseDeployDiagnostic(component, message) } satisfies FileResponseFailure];
      }

      return (
        isWebAppBundle(component)
          ? [
              {
                ...base,
                state,
                filePath: component.content,
              },
              ...component.walkContent().map((filePath) => ({
                fullName: getWebAppBundleContentFullName(component)(filePath),
                type: 'DigitalExperience',
                state,
                filePath,
              })),
            ]
          : [
              ...(shouldWalkContent(component)
                ? component.walkContent().map((filePath): FileResponseSuccess => ({ ...base, state, filePath }))
                : []),
              ...(component.xml ? [{ ...base, state, filePath: component.xml }] : []),
            ]
      ).map((response) => ({
        ...response,
        filePath:
          // deployResults will produce filePaths relative to cwd, which might not be set in all environments
          // if our CS had a projectDir set, we'll make the results relative to that path
          projectPath && process.cwd() === projectPath ? response.filePath : join(projectPath ?? '', response.filePath),
      })) satisfies FileResponseSuccess[];
    });

const getWebAppBundleContentFullName =
  (component: SourceComponentWithContent) =>
  (filePath: string): string => {
    // Normalize paths to ensure relative() works correctly on Windows
    const normalizedContent = component.content.split(sep).join(posix.sep);
    const normalizedFilePath = filePath.split(sep).join(posix.sep);
    const relPath = posix.relative(normalizedContent, normalizedFilePath);
    return posix.join(component.fullName, relPath);
  };

/**
 * Groups messages from the deploy result by component fullName and type
 */
export const getDeployMessages = (result: MetadataApiDeployStatus): Map<string, DeployMessage[]> => {
  const messageMap = new Map<string, DeployMessage[]>();

  const failedComponentKeys = new Set<string>();
  const failureMessages = ensureArray(result.details.componentFailures);
  const successMessages = ensureArray(result.details.componentSuccesses);

  for (const failure of failureMessages) {
    const sanitized = sanitizeDeployMessage(failure);
    const componentLike: ComponentLike = {
      fullName: sanitized.fullName,
      type: sanitized.componentType,
    };
    const key = toKey(componentLike);
    if (!messageMap.has(key)) {
      messageMap.set(key, []);
    }
  }

  for (const success of successMessages) {
    const sanitized = sanitizeDeployMessage(success);
    const componentLike: ComponentLike = {
      fullName: sanitized.fullName,
      type: sanitized.componentType,
    };
    const key = toKey(componentLike);
    // this will ensure successes aren't reported if there is a failure for
    // the same component. e.g. lwc returns failures and successes
    if (!failedComponentKeys.has(key)) {
      messageMap.set(key, [sanitized]);
    }
  }

  return messageMap;
};

export const getState = (message: DeployMessage): ComponentStatus => {
  if (isTrue(message.created)) {
    return ComponentStatus.Created;
  } else if (isTrue(message.changed)) {
    return ComponentStatus.Changed;
  } else if (isTrue(message.deleted)) {
    return ComponentStatus.Deleted;
  } else if (!isTrue(message.success)) {
    return ComponentStatus.Failed;
  }
  return ComponentStatus.Unchanged;
};

/* Type guard for asserting that a DeployMessages has a componentType, problem, and problemType === Warning*/
export const isComponentNotFoundWarningMessage = (
  message: DeployMessage
): message is DeployMessage & Required<Pick<DeployMessage, 'componentType' | 'problem' | 'problemType'>> =>
  hasComponentType(message) &&
  message.problemType === 'Warning' &&
  typeof message.problem === 'string' &&
  message.problem?.startsWith(`No ${message.componentType} named: `);

const hasComponentType = (message: DeployMessage): message is DeployMessage & { componentType: string } =>
  typeof message.componentType === 'string';

export const toKey = (component: ComponentLike): string => {
  const type = typeof component.type === 'string' ? component.type : component.type.name;
  return `${type}#${shouldConvertPaths ? component.fullName.split(sep).join(posix.sep) : component.fullName}`;
};

const isTrue = (value: BooleanString): boolean => value === 'true' || value === true;
export const shouldConvertPaths = sep !== posix.sep;
