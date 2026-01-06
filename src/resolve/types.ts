/*
 * Copyright 2026, Salesforce, Inc.
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

import { SourcePath } from '../common/types';
import { MetadataType } from '../registry/types';
import { SourceComponent } from './sourceComponent';

export type MetadataComponent = {
  fullName: string;
  type: MetadataType;
  parent?: MetadataComponent;
};

export type MetadataMember = {
  fullName: string;
  type: string;
};

export type ComponentLike = MetadataComponent | MetadataMember;

/**
 * Properties of a metadata xml's file name
 */
export type MetadataXml = {
  fullName: string;
  suffix?: string;
  path: SourcePath;
};

export type VirtualFile = {
  name: string;
  data?: Buffer;
};

export type VirtualDirectory = {
  dirPath: SourcePath;
  children: Array<VirtualFile | string>;
};

/**
 * Infers the source format structure of a metadata component when given a file path.
 */
export type SourceAdapter = {
  /**
   * Create a metadata component object from a file path.
   *
   * @param fsPath Path to resolve
   * @param isResolvingSource Whether the path to resolve is a single file
   */
  getComponent(fsPath: SourcePath, isResolvingSource?: boolean): SourceComponent | undefined;

  /**
   * Whether the adapter allows content-only metadata definitions.
   */
  allowMetadataWithContent(): boolean;
};
