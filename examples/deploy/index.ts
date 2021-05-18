/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  ComponentSet,
  FromSourceOptions,
  MetadataMember,
} from '@salesforce/source-deploy-retrieve';

/**
 * Deploy components resolved from a file path.
 */
export async function deployUsingSourcePath(fsPath: string): Promise<void> {
  const result = await ComponentSet.fromSource(fsPath)
    .deploy({ usernameOrConnection: 'user@example.com' })
    .start();

  console.log(result.getFileResponses());
}

/**
 * Deploy using a manifest file (package.xml)
 *
 * The library does not make assumptions about how a manifest file is being used
 * to perform a deploy or retrieve operation. Below is an example of following
 * the SFDX behavior, which uses the manifest file as a filter for deploying any
 * components that match manifest entries across a project's package directories.
 */
export async function deployUsingManifestFile(
  manifestPath: string,
  packageDirectoryPaths: string[]
): Promise<void> {
  const components = await ComponentSet.fromManifest({
    manifestPath,
    resolveSourcePaths: packageDirectoryPaths,
  });

  const result = await components.deploy({ usernameOrConnection: 'user@example.com' }).start();

  console.log(result.getFileResponses());
}

/**
 * Deploy using metadata members (components addressed by name)
 *
 * e.g. `{ fullName: 'TestClass', type: 'ApexClass' }`
 *
 * The library does not make assumptions about how members are being used to
 * perform a deploy or retrieve operation. Below is an example of following the SFDX
 * behavior, which uses the members as a filter for deploying any components that
 * match a `fullName` and `type` pair across a project's package directories.
 */
export async function deployUsingMembers(
  members: MetadataMember[],
  packageDirectoryPaths: string[]
): Promise<void> {
  const options: FromSourceOptions = {
    fsPaths: packageDirectoryPaths,
    include: new ComponentSet(members),
  };

  const result = await ComponentSet.fromSource(options)
    .deploy({ usernameOrConnection: 'user@example.com' })
    .start();

  console.log(result.getFileResponses());
}

/**
 * Deploy with a file path and subscribe to updates.
 *
 * This example also demonstrates cancellation
 */
export async function deployAndListen(fsPath: string): Promise<void> {
  const operation = ComponentSet.fromSource(fsPath).deploy({
    usernameOrConnection: 'user@example.com ',
  });

  let pollCount = 0;
  const pollInterval = 100;

  // subscribe to deploy status event and report on the progress
  operation.onUpdate((response) => {
    const { status, numberComponentsDeployed, numberComponentsTotal } = response;
    const progressMessage = `Status: ${status}\tProgress: ${numberComponentsDeployed}/${numberComponentsTotal}`;
    console.log(progressMessage);
    pollCount += 1;

    const timeElapsed = pollCount * pollInterval;

    // if the operation is taking longer than 5 seconds, cancel it
    if (timeElapsed === 5000) {
      operation.cancel();
    }
  });

  // subscribe to when a cancellation has finished
  operation.onCancel(() => {
    console.log('The deploy operation was canceled');
  });

  operation.start(pollInterval);
}
