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
import { VirtualTreeContainer } from '../../src/resolve/treeContainers';

describe('VirtualTreeContainer', () => {
  describe('fromFilePaths', () => {
    it('builds parent directories for a single file path', () => {
      const filePath = join('force-app', 'main', 'default', 'classes', 'Foo.cls');
      const tree = VirtualTreeContainer.fromFilePaths([filePath]);
      expect(tree.exists(filePath)).to.be.true;
      expect(tree.isDirectory(join('force-app', 'main', 'default', 'classes'))).to.be.true;
      expect(tree.readDirectory(join('force-app', 'main', 'default', 'classes'))).to.include.members(['Foo.cls']);
    });

    it('merges overlapping paths into shared directory entries', () => {
      const base = join('force-app', 'main', 'default');
      const a = join(base, 'classes', 'A.cls');
      const b = join(base, 'triggers', 'T.trigger');
      const tree = VirtualTreeContainer.fromFilePaths([a, b]);
      expect(tree.exists(a)).to.be.true;
      expect(tree.exists(b)).to.be.true;
      const rootChildren = tree.readDirectory(base);
      expect(rootChildren).to.include.members(['classes', 'triggers']);
      expect(tree.readDirectory(join(base, 'classes'))).to.deep.equal(['A.cls']);
      expect(tree.readDirectory(join(base, 'triggers'))).to.deep.equal(['T.trigger']);
    });

    it('deduplicates identical paths', () => {
      const p = join('pkg', 'objects', 'Obj__c', 'Obj__c.object-meta.xml');
      const tree = VirtualTreeContainer.fromFilePaths([p, p, p]);
      expect(tree.exists(p)).to.be.true;
      expect(tree.readDirectory(join('pkg', 'objects', 'Obj__c'))).to.deep.equal(['Obj__c.object-meta.xml']);
    });

    it('handles a deep path', () => {
      const parts = ['a', 'b', 'c', 'd', 'e', 'deep.txt'];
      const filePath = join(...parts);
      const tree = VirtualTreeContainer.fromFilePaths([filePath]);
      expect(tree.exists(filePath)).to.be.true;
      expect(tree.isDirectory(join('a', 'b', 'c', 'd'))).to.be.true;
      expect(tree.readDirectory(join('a', 'b', 'c', 'd'))).to.deep.equal(['e']);
    });

    it('ignores non-string entries like the previous implementation', () => {
      const p = join('x', 'y.txt');
      const tree = VirtualTreeContainer.fromFilePaths([p, undefined as unknown as string, null as unknown as string]);
      expect(tree.exists(p)).to.be.true;
    });

    it('produces no tree entries for a root-level filename (no parent segments)', () => {
      const tree = VirtualTreeContainer.fromFilePaths(['rootOnly.txt']);
      expect(tree.exists('rootOnly.txt')).to.be.false;
      expect(() => tree.readFileSync('rootOnly.txt')).to.throw();
    });
  });
});
