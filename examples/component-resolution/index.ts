/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
// @ts-ignore
import { ComponentSet, ZipTreeContainer } from '@salesforce/source-deploy-retrieve';
import fs from 'fs';

/**
 * Print the component count of a file or directory path by type.
 */
export function printComponentCount(fsPath: string): void {
  const components = ComponentSet.fromSource(fsPath);
  const manifestObject = components.getObject();
  const total = components.size;

  console.log(`Total Components: ${total}`);

  for (const typeMember of manifestObject.Package.types) {
    const typeName = typeMember.name;
    const componentCount = typeMember.members.length;
    console.log(`- ${typeName}\t${componentCount}`);
  }
}

/**
 * Combine the members of multiple manifest files into one.
 */
export async function combineManifestFiles(...manifestPaths: string[]): Promise<string> {
  let aggregate = new ComponentSet();

  for (const fsPath of manifestPaths) {
    const manifestSet = await ComponentSet.fromManifest(fsPath);
    aggregate = new ComponentSet([...aggregate, ...manifestSet]);
  }

  return aggregate.getPackageXml();
}

/**
 * Resolve a component set from a zip file.
 */
export async function resolveSourceInZip(zipFilePath: string): Promise<ComponentSet> {
  const zipBuffer = fs.readFileSync(zipFilePath);
  const zipTree = await ZipTreeContainer.create(zipBuffer);

  return ComponentSet.fromSource({
    fsPaths: ['.'],
    tree: zipTree,
  });
}
