/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SourcePath } from '../common/types';
import { SourceComponent } from '.';
import { MetadataType } from '../registry';

export interface MetadataComponent {
  fullName: string;
  type: MetadataType;
  parent?: MetadataComponent;
}

export interface MetadataMember {
  fullName: string;
  type: string;
}

export type ComponentLike = MetadataComponent | MetadataMember;

/**
 * Properties of a metadata xml's file name
 */
export type MetadataXml = {
  fullName: string;
  suffix: string;
  path: SourcePath;
};

export type VirtualFile = {
  name: string;
  data?: Buffer;
};

export type VirtualDirectory = {
  dirPath: SourcePath;
  children: (VirtualFile | string)[];
};

/**
 * Infers the source format structure of a metadata component when given a file path.
 */
export interface SourceAdapter {
  /**
   * Create a metadata component object from a file path.
   *
   * @param fsPath Path to resolve
   * @param isResolvingSource Whether the path to resolve is a single file
   */
  getComponent(fsPath: SourcePath, isResolvingSource?: boolean): SourceComponent;

  /**
   * Whether the adapter allows content-only metadata definitions.
   */
  allowMetadataWithContent(): boolean;
}
