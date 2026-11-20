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
import {
  ComponentSet,
  ComponentSetBuilder,
  DestructiveChangesType,
  RegistryAccess,
  SourceComponent,
  VirtualTreeContainer,
} from '../../src';
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
    { dirPath: D360_DIR, children: ['dataLakeObjects', 'dataStreamBundles', 'dataspace'] },
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
        // Names a file whose sidecar is for another component.
        ...component('DataLakeObject', 'strayDlo__dll', undefined, [
          { componentType: 'DataModelObject', name: 'strayDmo__dlm', dataspaceName: 'default' },
        ]),
      ],
    },
    {
      dirPath: join(D360_DIR, 'dataStreamBundles'),
      children: [
        ...component('DataStreamBundle', 'myStream', undefined, [
          { componentType: 'DataLakeObject', name: 'myDlo__dll' },
        ]),
        // The server names the DLO with the dataspace the bundle uses it in, though the DLO is stored bare.
        ...component('DataStreamBundle', 'pinnedStream', undefined, [
          { componentType: 'DataLakeObject', name: 'myDlo__dll', dataspaceName: 'default' },
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
        children: [
          ...component('DataModelObject', 'myDmo__dlm', ds),
          // Stored as strayDmo__dlm, with the sidecar of otherDmo__dlm.
          ...component('DataModelObject', 'otherDmo__dlm', ds).map((file) => ({
            ...file,
            name: file.name.replace('otherDmo__dlm', 'strayDmo__dlm'),
          })),
        ],
      },
    ]),
  ]);
  const full = ComponentSet.fromSource({ fsPaths: ['force-app'], tree, registry });

  const expand = (member: string): ComponentSet => {
    const [type, fullName] = member.split(':');
    const requested = new ComponentSet([], registry);
    requested.add(full.getSourceComponents({ fullName, type: registry.getTypeByName(type) }).first()!);
    return expandD360ComponentSet(requested, registry);
  };

  // Mirrors what the builder produces for `DataLakeObject:<dataspace>.myDlo__dll`: the requested name,
  // plus the local component without a manifest entry of its own.
  const expandInDataspaces = (...dataspaces: string[]): ComponentSet => {
    const type = registry.getTypeByName('DataLakeObject');
    const requested = new ComponentSet([], registry);
    dataspaces.forEach((ds) => requested.add({ type, fullName: `${ds}.myDlo__dll` }));
    requested.addWithoutManifestEntry(full.getSourceComponents({ type, fullName: 'myDlo__dll' }).first()!);
    return expandD360ComponentSet(requested, registry);
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

    expect(members(expandD360ComponentSet(requested, registry))).to.deep.equal([
      'DataLakeObject:sharedDlo__dll',
      'DataModelObject:default.myDmo__dlm',
    ]);
  });

  it('should send the sidecar with only the peers of the requested dataspace', () => {
    const type = registry.getTypeByName('DataLakeObject');
    const requested = new ComponentSet([], registry);
    requested.add({ type, fullName: 'default.sharedDlo__dll' });
    requested.addWithoutManifestEntry(full.getSourceComponents({ type, fullName: 'sharedDlo__dll' }).first()!);

    const dlo = expandD360ComponentSet(requested, registry)
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
      expandD360ComponentSet(requested, registry).getSourceComponents({ type, fullName: 'sharedDlo__dll' }).first()
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

  describe('the set it is given', () => {
    // Resolved again for each test, since marking a component for delete changes the component itself.
    const resolveOne = (type: string, fullName: string): SourceComponent =>
      ComponentSet.fromSource({ fsPaths: ['force-app'], tree, registry })
        .getSourceComponents({ type: registry.getTypeByName(type), fullName })
        .first()!;
    const dlo = (): SourceComponent => resolveOne('DataLakeObject', 'myDlo__dll');
    const dmo = (dataspace: string): SourceComponent => resolveOne('DataModelObject', `${dataspace}.myDmo__dlm`);

    it('should add the peers to it and keep its versions and other members', async () => {
      const requested = new ComponentSet([dlo(), { type: 'ApexClass', fullName: '*' }], registry);
      requested.apiVersion = '68.0';
      requested.sourceApiVersion = '67.0';

      const expanded = expandD360ComponentSet(requested, registry);

      expect(expanded).to.equal(requested);
      expect(expanded.apiVersion).to.equal('68.0');
      expect(expanded.sourceApiVersion).to.equal('67.0');
      expect(members(expanded)).to.have.length(5);
      expect((await expanded.getObject()).Package).to.deep.include({
        types: [
          { name: 'ApexClass', members: ['*'] },
          { name: 'DataLakeObject', members: ['myDlo__dll'] },
        ],
        version: '67.0',
      });
    });

    it('should keep a component marked for delete as a delete, without its peers', async () => {
      const requested = new ComponentSet([], registry);
      requested.add(dlo(), DestructiveChangesType.POST);

      const expanded = expandD360ComponentSet(requested, registry);

      expect(members(expanded)).to.deep.equal(['DataLakeObject:myDlo__dll']);
      expect((await expanded.getObject(DestructiveChangesType.POST)).Package.types).to.deep.equal([
        { name: 'DataLakeObject', members: ['myDlo__dll'] },
      ]);
      expect((await expanded.getObject()).Package.types).to.be.empty;
    });

    it('should leave a peer marked for delete as a delete', () => {
      const requested = new ComponentSet([dlo()], registry);
      requested.add(dmo('other'), DestructiveChangesType.POST);

      const expanded = expandD360ComponentSet(requested, registry);

      expect(
        expanded
          .getSourceComponents()
          .toArray()
          .filter((c) => c.isMarkedForDelete())
          .map((c) => c.fullName)
      ).to.deep.equal(['other.myDmo__dlm']);
      expect(members(expanded)).to.include('DataModelObject:default.myDmo__dlm');
    });
  });

  const expandBundle = (name: string): ComponentSet => {
    const type = registry.getTypeByName('DataStreamBundle');
    const requested = new ComponentSet([{ type, fullName: `default.${name}` }], registry);
    requested.addWithoutManifestEntry(full.getSourceComponents({ type, fullName: name }).first()!);
    return expandD360ComponentSet(requested, registry);
  };

  it('should pull the Data Lake Object of a data stream bundle and its closure', () => {
    expect(members(expandBundle('myStream'))).to.deep.equal([
      'DataLakeObject:myDlo__dll',
      'DataModelObject:default.myDmo__dlm',
      'DataStreamBundle:myStream',
      'DataspaceMember:default.myDlo__dll',
    ]);
  });

  it('should pull a Data Lake Object a bundle references with a dataspace, though the DLO is stored bare', () => {
    expect(members(expandBundle('pinnedStream'))).to.deep.equal([
      'DataLakeObject:myDlo__dll',
      'DataModelObject:default.myDmo__dlm',
      'DataStreamBundle:pinnedStream',
      'DataspaceMember:default.myDlo__dll',
    ]);
  });

  it('should not pull a file whose sidecar is for another component', () => {
    expect(members(expand('DataLakeObject:strayDlo__dll'))).to.deep.equal(['DataLakeObject:strayDlo__dll']);
  });

  it('should leave a set without Data Cloud components as it is', () => {
    const requested = new ComponentSet([{ type: 'ApexClass', fullName: 'MyClass' }], registry);

    expect([...expandD360ComponentSet(requested, registry)]).to.have.length(1);
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

  it('should resolve a dataspace-qualified name in a manifest', async () => {
    const manifestPath = join(projectDir, 'package.xml');
    writeFileSync(
      manifestPath,
      '<?xml version="1.0" encoding="UTF-8"?><Package xmlns="http://soap.sforce.com/2006/04/metadata">' +
        '<types><members>default.myDlo__dll</members><name>DataLakeObject</name></types><version>68.0</version></Package>'
    );
    const set = await ComponentSetBuilder.build({ manifest: { manifestPath, directoryPaths: [projectDir] } });
    expect(members(set)).to.deep.equal(['DataLakeObject:myDlo__dll']);
    expect((await set.getObject()).Package.types).to.deep.equal([
      { name: 'DataLakeObject', members: ['default.myDlo__dll'] },
    ]);
  });

  it('should keep the bare name in the manifest when it is requested too', async () => {
    const manifestPath = join(projectDir, 'package.xml');
    writeFileSync(
      manifestPath,
      '<?xml version="1.0" encoding="UTF-8"?><Package xmlns="http://soap.sforce.com/2006/04/metadata">' +
        '<types><members>myDlo__dll</members><members>default.myDlo__dll</members><name>DataLakeObject</name></types>' +
        '<version>68.0</version></Package>'
    );
    const set = await ComponentSetBuilder.build({ manifest: { manifestPath, directoryPaths: [projectDir] } });
    expect((await set.getObject()).Package.types).to.deep.equal([
      { name: 'DataLakeObject', members: ['default.myDlo__dll', 'myDlo__dll'] },
    ]);
  });
});
