/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
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
