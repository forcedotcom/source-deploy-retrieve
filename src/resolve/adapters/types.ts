/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { MetadataType } from '../../registry/types';
import { RegistryAccess } from '../../registry/registryAccess';
import { SourcePath } from '../../common/types';
import { SourceComponent } from '../sourceComponent';
import { MetadataXml } from '../types';
import { ForceIgnore } from '../forceIgnore';
import { TreeContainer } from '../treeContainers';

export type MaybeGetComponent = (context: AdapterContext) => (input: GetComponentInput) => SourceComponent | undefined;
export type GetComponent = (context: AdapterContext) => (input: GetComponentInput) => SourceComponent;
export type FindRootMetadata = (type: MetadataType, path: SourcePath) => MetadataXml | undefined;

/** requires a component, will definitely return one */
export type Populate = (
  context: AdapterContext
) => (type: MetadataType) => (trigger: SourcePath, component: SourceComponent) => SourceComponent;

export type MaybePopulate = (
  context: AdapterContext
) => (type: MetadataType) => (trigger: SourcePath, component?: SourceComponent) => SourceComponent | undefined;

export type GetComponentInput = {
  type: MetadataType;
  path: SourcePath;
  /** either a MetadataXml OR a function that resolves to it using the type/path  */
  metadataXml?: MetadataXml | FindRootMetadata;
};

export type AdapterContext = {
  registry: RegistryAccess;
  forceIgnore?: ForceIgnore;
  tree: TreeContainer;
  isResolvingSource?: boolean;
};
