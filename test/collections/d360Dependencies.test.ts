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
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect } from 'chai';
import { ComponentSet, RegistryAccess, VirtualTreeContainer } from '../../src';
import { expandD360ComponentSet, resolveDataspaceQualifiedComponents } from '../../src/collections/d360Dependencies';

type Ref = { componentType: string; name: string; dataspaceName?: string };

const D360_DIR = join('force-app', 'd360');

const component = (
  componentType: string,
  componentName: string,
  dataspaceName?: string,
  retrieveWith: Ref[] = []
): Array<{ name: string; data: Buffer }> => [
  { name: `${componentName}.json`, data: Buffer.from('{}') },
  {
    name: `${componentName}.meta.json`,
    data: Buffer.from(JSON.stringify({ componentType, componentName, dataspaceName, retrieveWith })),
  },
];

const members = (set: ComponentSet): string[] =>
  set
    .getSourceComponents()
    .toArray()
    .map((c) => `${c.type.name}:${c.fullName}`)
    .sort();

describe('expandD360ComponentSet', () => {
  const registry = new RegistryAccess();

  // A Data Lake Object outside any dataspace, a member of two dataspaces. Its DataspaceMember shares its name.
  const tree = new VirtualTreeContainer([
    { dirPath: 'force-app', children: ['d360'] },
    { dirPath: D360_DIR, children: ['dataLakeObjects', 'dataspace'] },
    {
      dirPath: join(D360_DIR, 'dataLakeObjects'),
      children: [
        ...component('DataLakeObject', 'myDlo__dll', undefined, [
          { componentType: 'DataspaceMember', name: 'myDlo__dll' },
          { componentType: 'DataModelObject', name: 'myDmo__dlm' },
        ]),
        ...component('DataLakeObject', 'pinnedDlo__dll', undefined, [
          { componentType: 'DataModelObject', name: 'myDmo__dlm', dataspaceName: 'other' },
        ]),
        // Retrieved once per dataspace, so its sidecar names the peers of both.
        ...component('DataLakeObject', 'sharedDlo__dll', undefined, [
          { componentType: 'DataModelObject', name: 'myDmo__dlm', dataspaceName: 'default' },
          { componentType: 'DataModelObject', name: 'myDmo__dlm', dataspaceName: 'other' },
        ]),
      ],
    },
    { dirPath: join(D360_DIR, 'dataspace'), children: ['default', 'other'] },
    ...['default', 'other'].flatMap((ds) => [
      { dirPath: join(D360_DIR, 'dataspace', ds), children: ['dataspaceMembers', 'dataModelObjects'] },
      {
        dirPath: join(D360_DIR, 'dataspace', ds, 'dataspaceMembers'),
        children: component('DataspaceMember', 'myDlo__dll', ds),
      },
      {
        dirPath: join(D360_DIR, 'dataspace', ds, 'dataModelObjects'),
        children: component('DataModelObject', 'myDmo__dlm', ds),
      },
    ]),
  ]);
  const full = ComponentSet.fromSource({ fsPaths: ['force-app'], tree, registry });

  const expand = (member: string): ComponentSet => {
    const [type, fullName] = member.split(':');
    const requested = new ComponentSet([], registry);
    requested.add(full.getSourceComponents({ fullName, type: registry.getTypeByName(type) }).first()!);
    return expandD360ComponentSet(full, requested, registry);
  };

  // Mirrors what the builder produces for `DataLakeObject:<dataspace>.myDlo__dll`: the requested name,
  // plus the local component without a manifest entry of its own.
  const expandInDataspaces = (...dataspaces: string[]): ComponentSet => {
    const type = registry.getTypeByName('DataLakeObject');
    const requested = new ComponentSet([], registry);
    dataspaces.forEach((ds) => requested.add({ type, fullName: `${ds}.myDlo__dll` }));
    requested.addWithoutManifestEntry(full.getSourceComponents({ type, fullName: 'myDlo__dll' }).first()!);
    return expandD360ComponentSet(full, requested, registry);
  };

  it('should tell apart components of different types that share a name', () => {
    expect(members(expand('DataLakeObject:myDlo__dll'))).to.include.members([
      'DataLakeObject:myDlo__dll',
      'DataspaceMember:default.myDlo__dll',
    ]);
  });

  it('should pull peers from every dataspace for a component outside any dataspace', () => {
    expect(members(expand('DataLakeObject:myDlo__dll'))).to.deep.equal([
      'DataLakeObject:myDlo__dll',
      'DataModelObject:default.myDmo__dlm',
      'DataModelObject:other.myDmo__dlm',
      'DataspaceMember:default.myDlo__dll',
      'DataspaceMember:other.myDlo__dll',
    ]);
  });

  it('should list only the requested component in the manifest', async () => {
    expect((await expand('DataLakeObject:myDlo__dll').getObject()).Package.types).to.deep.equal([
      { name: 'DataLakeObject', members: ['myDlo__dll'] },
    ]);
  });

  it('should pull a peer only from the dataspace its reference names', () => {
    expect(members(expand('DataLakeObject:pinnedDlo__dll'))).to.deep.equal([
      'DataLakeObject:pinnedDlo__dll',
      'DataModelObject:other.myDmo__dlm',
    ]);
  });

  it('should pull peers only from the requested dataspace', () => {
    expect(members(expandInDataspaces('default'))).to.deep.equal([
      'DataLakeObject:myDlo__dll',
      'DataModelObject:default.myDmo__dlm',
      'DataspaceMember:default.myDlo__dll',
    ]);
  });

  it('should skip peers named for another dataspace than the requested one', () => {
    const type = registry.getTypeByName('DataLakeObject');
    const requested = new ComponentSet([], registry);
    requested.add({ type, fullName: 'default.sharedDlo__dll' });
    requested.addWithoutManifestEntry(full.getSourceComponents({ type, fullName: 'sharedDlo__dll' }).first()!);

    expect(members(expandD360ComponentSet(full, requested, registry))).to.deep.equal([
      'DataLakeObject:sharedDlo__dll',
      'DataModelObject:default.myDmo__dlm',
    ]);
  });

  it('should send the sidecar with only the peers of the requested dataspace', () => {
    const type = registry.getTypeByName('DataLakeObject');
    const requested = new ComponentSet([], registry);
    requested.add({ type, fullName: 'default.sharedDlo__dll' });
    requested.addWithoutManifestEntry(full.getSourceComponents({ type, fullName: 'sharedDlo__dll' }).first()!);

    const dlo = expandD360ComponentSet(full, requested, registry)
      .getSourceComponents({ type, fullName: 'sharedDlo__dll' })
      .first()!;
    const sidecar = dlo.content!.replace(/\.json$/, '.meta.json');
    const parse = (data: Buffer): { retrieveWith: Array<{ dataspaceName?: string }> } =>
      JSON.parse(data.toString()) as { retrieveWith: Array<{ dataspaceName?: string }> };

    expect(parse(dlo.tree.readFileSync(sidecar)).retrieveWith.map((ref) => ref.dataspaceName)).to.deep.equal([
      'default',
    ]);
    expect(
      parse(full.getSourceComponents({ type, fullName: 'sharedDlo__dll' }).first()!.tree.readFileSync(sidecar))
        .retrieveWith
    ).to.have.length(2);
  });

  it('should send the sidecar as is for a component requested by its bare name', () => {
    const type = registry.getTypeByName('DataLakeObject');
    const original = full.getSourceComponents({ type, fullName: 'sharedDlo__dll' }).first()!;
    const requested = new ComponentSet([original], registry);

    expect(
      expandD360ComponentSet(full, requested, registry)
        .getSourceComponents({ type, fullName: 'sharedDlo__dll' })
        .first()
    ).to.equal(original);
  });

  it('should pull peers from each requested dataspace', () => {
    expect(members(expandInDataspaces('default', 'other'))).to.have.length(5);
  });

  it('should list the dataspace-qualified name in the manifest', async () => {
    expect((await expandInDataspaces('default').getObject()).Package.types).to.deep.equal([
      { name: 'DataLakeObject', members: ['default.myDlo__dll'] },
    ]);
  });

  it('should pull the Data Lake Object of a data stream bundle and its closure', () => {
    const bundles = ComponentSet.fromSource({
      fsPaths: ['force-app'],
      tree: new VirtualTreeContainer([
        { dirPath: 'force-app', children: ['d360'] },
        { dirPath: D360_DIR, children: ['dataStreamBundles'] },
        {
          dirPath: join(D360_DIR, 'dataStreamBundles'),
          children: component('DataStreamBundle', 'myStream', undefined, [
            { componentType: 'DataLakeObject', name: 'myDlo__dll' },
          ]),
        },
      ]),
      registry,
    });
    const project = new ComponentSet([...full.getSourceComponents(), ...bundles.getSourceComponents()], registry);
    const type = registry.getTypeByName('DataStreamBundle');
    const requested = new ComponentSet([{ type, fullName: 'default.myStream' }], registry);
    requested.addWithoutManifestEntry(bundles.getSourceComponents({ type, fullName: 'myStream' }).first()!);
    expect(members(expandD360ComponentSet(project, requested, registry))).to.deep.equal([
      'DataLakeObject:myDlo__dll',
      'DataModelObject:default.myDmo__dlm',
      'DataStreamBundle:myStream',
      'DataspaceMember:default.myDlo__dll',
    ]);
  });
});

describe('resolveDataspaceQualifiedComponents', () => {
  const registry = new RegistryAccess();
  let projectDir: string;

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), 'd360-'));
    const typeDir = join(projectDir, 'd360', 'dataLakeObjects');
    mkdirSync(typeDir, { recursive: true });
    component('DataLakeObject', 'myDlo__dll').forEach(({ name, data }) => writeFileSync(join(typeDir, name), data));
  });

  afterEach(() => rmSync(projectDir, { recursive: true, force: true }));

  const resolve = (fullName: string): ComponentSet => {
    const set = new ComponentSet([{ type: registry.getTypeByName('DataLakeObject'), fullName }], registry);
    resolveDataspaceQualifiedComponents(set, [projectDir], registry);
    return set;
  };

  it('should resolve a dataspace-qualified name to the local component', () => {
    expect(members(resolve('default.myDlo__dll'))).to.deep.equal(['DataLakeObject:myDlo__dll']);
  });

  it('should keep the requested name in the manifest', async () => {
    expect((await resolve('default.myDlo__dll').getObject()).Package.types).to.deep.equal([
      { name: 'DataLakeObject', members: ['default.myDlo__dll'] },
    ]);
  });

  it('should leave a name without a dataspace alone', () => {
    expect(members(resolve('unknown__dll'))).to.be.empty;
  });
});
