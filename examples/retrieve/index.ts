/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
// @ts-ignore
import { ComponentSet, MetadataMember } from '@salesforce/source-deploy-retrieve';
import * as path from 'path';

/**
 * Retrieve all Apex classes in the org to ./myClasses
 */
export async function retrieveAllClasses(): Promise<void> {
  const result = await new ComponentSet([{ fullName: '*', type: 'ApexClass' }])
    .retrieve({
      usernameOrConnection: 'user@example.com',
      output: path.join(process.cwd(), 'myClasses'),
    })
    .start();

  console.log(`Retrieved ${result.components.size} Apex classes:`);
}

/**
 * Retrieve components resolved from a file path (SFDX command).
 */
export async function forceSourceRetrievePath(fsPath: string, username: string): Promise<void> {
  const result = await ComponentSet.fromSource(fsPath)
    .retrieve({
      usernameOrConnection: username,
      output: process.cwd(),
      merge: true,
    })
    .start();

  console.log(result.getFileResponses());
}

/**
 * Retrieve using a manifest file (package.xml) (SFDX command).
 */
export async function forceSourceRetrieveManifest(
  manifestPath: string,
  packageDirectoryPaths: string[],
  username: string
): Promise<void> {
  const defaultPackageDirectory = packageDirectoryPaths[0];

  const components = await ComponentSet.fromManifest({
    manifestPath,
    resolveSourcePaths: packageDirectoryPaths,
    forceAddWildcards: true,
  });

  const result = await components
    .retrieve({
      usernameOrConnection: username,
      output: defaultPackageDirectory,
      merge: true,
    })
    .start();

  console.log(result.getFileResponses());
}

/**
 * Retrieve using metadata members (SFDX command).
 *
 * e.g. `{ fullName: 'TestClass', type: 'ApexClass' }`
 */
export async function forceSourceRetrieveMetadata(
  members: MetadataMember[],
  packageDirectoryPaths: string[],
  username: string
): Promise<void> {
  const result = await ComponentSet.fromSource({
    fsPaths: packageDirectoryPaths,
    include: new ComponentSet(members),
  })
    .retrieve({
      usernameOrConnection: username,
      output: process.cwd(),
      merge: true,
    })
    .start();

  console.log(result.getFileResponses());
}

/**
 * Retrieve with a file path and subscribe to updates.
 *
 * This example also demonstrates cancellation
 */
export async function retrieveAndListen(fsPath: string, username: string): Promise<void> {
  const operation = ComponentSet.fromSource(fsPath).retrieve({
    usernameOrConnection: username,
    output: process.cwd(),
  });

  let updates = 0;

  // subscribe to deploy status event and report on the progress
  operation.onUpdate((response) => {
    const { status } = response;
    const progressMessage = `Status: ${status}`;
    console.log(progressMessage);
    updates += 1;

    // if the operation is taking longer than 30 seconds, cancel it
    if (updates === 10) {
      operation.cancel();
    }
  });

  // if after 10 updates the operation hasn't finished, cancel it.
  operation.onCancel(() => {
    console.log('The retrieve operation was canceled');
  });

  operation.start();
}
