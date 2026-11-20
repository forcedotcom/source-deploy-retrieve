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
import { join } from 'node:path';
import { expect } from 'chai';
import { ComponentSet, RegistryAccess, VirtualTreeContainer } from '../../../src';
import { getD360RelativePath } from '../../../src/resolve/adapters/d360SourceAdapter';

const files = (name: string): Array<{ name: string; data: Buffer }> => [
  { name: `${name}.json`, data: Buffer.from('{}') },
  { name: `${name}.meta.json`, data: Buffer.from('{}') },
];

describe('D360SourceAdapter', () => {
  const registry = new RegistryAccess();

  const resolve = (dirPath: string): string[] => {
    const tree = new VirtualTreeContainer([{ dirPath, children: files('myDlo__dll') }]);
    return ComponentSet.fromSource({ fsPaths: [dirPath], tree, registry })
      .getSourceComponents()
      .toArray()
      .map((c) => `${c.type.name}:${c.fullName}`);
  };

  it('should resolve a component outside any dataspace under its d360 folder', () => {
    expect(resolve(join('force-app', 'd360', 'dataLakeObjects'))).to.deep.equal(['DataLakeObject:myDlo__dll']);
  });

  it('should resolve a component in a dataspace under its d360 folder', () => {
    expect(resolve(join('force-app', 'd360', 'dataspace', 'default', 'dataLakeObjects'))).to.deep.equal([
      'DataLakeObject:default.myDlo__dll',
    ]);
  });

  it('should reject a component that is not under a d360 folder', () => {
    expect(() => resolve(join('force-app', 'main', 'default', 'dataLakeObjects'))).to.throw(
      /must be stored under a d360 folder/
    );
  });
});

describe('getD360RelativePath', () => {
  it('should keep the path from the d360 folder down', () => {
    expect(getD360RelativePath(join('a', 'd360', 'dataLakeObjects', 'x.json'), 'dataLakeObjects')).to.equal(
      join('d360', 'dataLakeObjects', 'x.json')
    );
    expect(
      getD360RelativePath(join('a', 'd360', 'dataspace', 'ds', 'dataTransforms', 'x.json'), 'dataTransforms')
    ).to.equal(join('d360', 'dataspace', 'ds', 'dataTransforms', 'x.json'));
  });

  it('should not mistake a dataspace named d360 for the d360 folder', () => {
    expect(
      getD360RelativePath(join('a', 'd360', 'dataspace', 'd360', 'dataTransforms', 'x.json'), 'dataTransforms')
    ).to.equal(join('d360', 'dataspace', 'd360', 'dataTransforms', 'x.json'));
  });

  it('should return undefined for any other path', () => {
    expect(getD360RelativePath(join('a', 'dataLakeObjects', 'x.json'), 'dataLakeObjects')).to.equal(undefined);
    expect(getD360RelativePath(join('d360', 'other', 'dataLakeObjects', 'x.json'), 'dataLakeObjects')).to.equal(
      undefined
    );
  });
});
