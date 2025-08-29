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

import { RegistryAccess } from '../registry/registryAccess';
import { TreeContainer } from '../resolve/treeContainers';

/**
 * File system path to a source file of a metadata component.
 */
export type SourcePath = string;

export type TreeOptions = {
  tree: TreeContainer;
};

export type RegistryOptions = {
  registry: RegistryAccess;
};

export type OptionalTreeRegistryOptions = Partial<TreeOptions> & Partial<RegistryOptions>;
