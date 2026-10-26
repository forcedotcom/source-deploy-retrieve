/*
 * Copyright 2026, Salesforce, Inc.
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
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { Readable } from 'node:stream';
import { expect } from 'chai';
import { ComponentSet, RegistryAccess, VirtualTreeContainer } from '../../../src';
import { D360MetadataTransformer, mergeSidecars } from '../../../src/convert/transformers/d360MetadataTransformer';

const sidecar = (retrieveWith: Array<{ componentType: string; name: string; dataspaceName?: string }>) =>
  JSON.stringify({ componentType: 'DataLakeObject', componentName: 'Orders__dll', requires: [], retrieveWith });

const parse = (json: string) => JSON.parse(json) as { retrieveWith?: unknown[]; dependsOn?: unknown };

const member = (dataspaceName: string) => ({ componentType: 'DataspaceMember', name: 'Orders__dll', dataspaceName });
const index = (name: string, dataspaceName: string) => ({ componentType: 'SecondaryIndex', name, dataspaceName });

describe('mergeSidecars', () => {
  it('keeps the peers of a dataspace the new retrieve did not cover', () => {
    const existing = sidecar([member('sales'), index('ByRegion', 'sales')]);
    const incoming = sidecar([member('default'), index('ByRegion', 'default')]);

    expect(parse(mergeSidecars(existing, incoming)).retrieveWith).to.deep.equal([
      member('sales'),
      index('ByRegion', 'sales'),
      member('default'),
      index('ByRegion', 'default'),
    ]);
  });

  it('replaces the peers of a dataspace the new retrieve covered', () => {
    const existing = sidecar([member('default'), index('Old', 'default'), member('sales')]);
    const incoming = sidecar([member('default'), index('New', 'default')]);

    expect(parse(mergeSidecars(existing, incoming)).retrieveWith).to.deep.equal([
      member('sales'),
      member('default'),
      index('New', 'default'),
    ]);
  });

  it('takes everything else from the new sidecar', () => {
    const existing = JSON.stringify({ componentType: 'DataLakeObject', dependsOn: { derived: ['x'] } });
    const incoming = JSON.stringify({ componentType: 'DataLakeObject', dependsOn: { derived: [] } });

    expect(parse(mergeSidecars(existing, incoming)).dependsOn).to.deep.equal({ derived: [] });
  });

  it('falls back to the new sidecar when the existing one is not valid JSON', () => {
    const incoming = sidecar([member('default')]);

    expect(mergeSidecars('not json', incoming)).to.equal(incoming);
  });
});

describe('D360MetadataTransformer', () => {
  const registry = new RegistryAccess();
  const sidecarPath = join('main', 'default', 'd360', 'dataLakeObjects', 'Orders__dll.meta.json');
  const retrieved = sidecar([member('default')]);
  let defaultDirectory: string;

  const dlo = () => {
    const tree = new VirtualTreeContainer([
      { dirPath: 'd360', children: ['dataLakeObjects'] },
      {
        dirPath: join('d360', 'dataLakeObjects'),
        children: [
          { name: 'Orders__dll.json', data: Buffer.from('{}') },
          { name: 'Orders__dll.meta.json', data: Buffer.from(retrieved) },
        ],
      },
    ]);
    const component = ComponentSet.fromSource({ fsPaths: ['d360'], registry, tree })
      .getSourceComponents()
      .first()!;
    // Behave like the zip a retrieve is read from: it streams, but can't read synchronously.
    const readFileSync = tree.readFileSync.bind(tree);
    tree.stream = (fsPath: string) => Readable.from(readFileSync(fsPath));
    tree.readFile = (fsPath: string) => Promise.resolve(readFileSync(fsPath));
    tree.readFileSync = () => {
      throw new Error('Method not implemented');
    };
    return component;
  };

  const writtenSidecar = async (): Promise<string> => {
    const transformer = new D360MetadataTransformer(registry);
    transformer.defaultDirectory = defaultDirectory;
    const info = (await transformer.toSourceFormat({ component: dlo() })).find((i) => i.output === sidecarPath)!;
    const chunks: Buffer[] = [];
    for await (const chunk of info.source as Readable) {
      chunks.push(Buffer.from(chunk as string | Buffer));
    }
    return Buffer.concat(chunks).toString('utf8');
  };

  beforeEach(async () => {
    defaultDirectory = await mkdtemp(join(tmpdir(), 'd360-'));
  });

  afterEach(async () => {
    await rm(defaultDirectory, { recursive: true, force: true });
  });

  it('writes the retrieved sidecar when the project has none', async () => {
    expect(await writtenSidecar()).to.equal(retrieved);
  });

  it('merges the retrieved sidecar into the one in the project', async () => {
    await mkdir(dirname(join(defaultDirectory, sidecarPath)), { recursive: true });
    await writeFile(join(defaultDirectory, sidecarPath), sidecar([member('sales')]));

    expect(parse(await writtenSidecar()).retrieveWith).to.deep.equal([member('sales'), member('default')]);
  });
});
