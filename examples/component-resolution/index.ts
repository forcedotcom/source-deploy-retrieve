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
