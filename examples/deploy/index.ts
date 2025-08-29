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
// @ts-ignore
import { ComponentSet, MetadataMember } from '@salesforce/source-deploy-retrieve';

/**
 * Deploy components resolved from a file path (SFDX Command).
 */
export async function forceSourceDeployPath(fsPath: string, username: string): Promise<void> {
  const result = await ComponentSet.fromSource(fsPath)
    .deploy({ usernameOrConnection: username })
    .start();

  console.log(result.getFileResponses());
}

/**
 * Deploy using a manifest file (package.xml) (SFDX Command).
 *
 * Uses the members in the manifest as a filter when resolving source components.
 */
export async function forceSourceDeployManifest(
  manifestPath: string,
  packageDirectoryPaths: string[],
  username: string
): Promise<void> {
  const components = await ComponentSet.fromManifest({
    manifestPath,
    resolveSourcePaths: packageDirectoryPaths,
  });

  const result = await components.deploy({ usernameOrConnection: username }).start();

  console.log(result.getFileResponses());
}

/**
 * Deploy using metadata members (SFDX Command).
 *
 * e.g. `{ fullName: 'TestClass', type: 'ApexClass' }`
 *
 * Uses the members as a filter when resolving source components.
 */
export async function forceSourceDeployMetadata(
  members: MetadataMember[],
  packageDirectoryPaths: string[],
  username: string
): Promise<void> {
  const result = await ComponentSet.fromSource({
    fsPaths: packageDirectoryPaths,
    include: new ComponentSet(members),
  })
    .deploy({ usernameOrConnection: username })
    .start();

  console.log(result.getFileResponses());
}

/**
 * Deploy with a file path and subscribe to updates.
 *
 * This example also demonstrates cancellation.
 */
export async function deployAndListen(fsPath: string, username: string): Promise<void> {
  const operation = ComponentSet.fromSource(fsPath).deploy({
    usernameOrConnection: username,
  });

  let updates = 0;

  // subscribe to deploy status event and report on the progress
  operation.onUpdate((response) => {
    const { status, numberComponentsDeployed, numberComponentsTotal } = response;
    const progressMessage = `Status: ${status}\tProgress: ${numberComponentsDeployed}/${numberComponentsTotal}`;
    console.log(progressMessage);
    updates += 1;

    // if after 10 updates the operation hasn't finished, cancel it.
    if (updates === 10) {
      operation.cancel();
    }
  });

  operation.onCancel(() => {
    console.log('The deploy operation was canceled');
  });

  operation.start();
}
