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
export {
  MetadataApiDeploy,
  MetadataApiDeployOptions,
  DeployResult,
  ScopedPreDeploy,
  ScopedPostDeploy,
  ScopedPreRetrieve,
  ScopedPostRetrieve,
  MetadataApiRetrieve,
  MetadataApiRetrieveOptions,
  RetrieveResult,
  ComponentDeployment,
  ComponentRetrieval,
  ComponentDiagnostic,
  FileResponse,
  FileResponseFailure,
  FileResponseSuccess,
  AsyncResult,
  RequestStatus,
  MetadataRequestStatus,
  RetrieveFailure,
  RetrieveSuccess,
  MetadataApiDeployStatus,
  DeployDetails,
  RunTestResult,
  CodeCoverage,
  LocationsNotCovered,
  CodeCoverageWarnings,
  Failures,
  Successes,
  DeployMessage,
  RetrieveRequest,
  RetrieveMessage,
  FileProperties,
  ComponentStatus,
  MetadataApiRetrieveStatus,
  PackageOption,
  PackageOptions,
  RetrieveOptions,
  DeployVersionData,
  DeployZipData,
  RetrieveVersionData,
} from './client';
export {
  MetadataConverter,
  WriteInfo,
  WriterFormat,
  DirectoryConfig,
  ZipConfig,
  MergeConfig,
  MetadataTransformer,
  SfdxFileFormat,
  ConvertOutputConfig,
  ConvertResult,
} from './convert';
export {
  MetadataResolver,
  ManifestResolver,
  ConnectionResolver,
  TreeContainer,
  NodeFSTreeContainer,
  VirtualTreeContainer,
  ZipTreeContainer,
  SourceComponent,
  MetadataComponent,
  MetadataMember,
  ComponentLike,
  MetadataXml,
  VirtualFile,
  VirtualDirectory,
  SourceAdapter,
  ForceIgnore,
} from './resolve';
export { SourcePath, TreeOptions, OptionalTreeRegistryOptions, RegistryOptions } from './common';
export {
  LazyCollection,
  ComponentSet,
  ComponentSetBuilder,
  ComponentSetOptions,
  DeploySetOptions,
  RetrieveSetOptions,
  PackageTypeMembers,
  PackageManifestObject,
  DestructiveChangesType,
  FromSourceOptions,
  FromManifestOptions,
} from './collections';

export { RegistryAccess, registry, getCurrentApiVersion, MetadataRegistry, MetadataType } from './registry';

// TODO: don't export these strategies
export { DecompositionStrategy, TransformerStrategy, RecompositionStrategy } from './registry/types';

export { presetMap } from './registry/presets/presetMap';
