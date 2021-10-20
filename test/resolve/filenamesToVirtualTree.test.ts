/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/* eslint-disable no-console */
import { join } from 'path';
import { expect } from 'chai';
import { MetadataResolver } from '../../src/resolve/metadataResolver';
import { filenamesToVirtualTree } from '../../src/resolve/filenamesToVirtualTree';

describe('two deleted files from an apex class', () => {
  const classesPath = join('force-app', 'main', 'default', 'classes');
  const tree = filenamesToVirtualTree([
    join(classesPath, 'TestOrderController.cls'),
    join(classesPath, 'TestOrderController.cls-meta.xml'),
  ]);

  it('tree has expected structure', () => {
    expect(tree.isDirectory('force-app'), 'force-app').to.equal(true);
    expect(tree.isDirectory(join('force-app', 'main')), 'force-app/main').to.equal(true);
    expect(
      tree.isDirectory(join('force-app', 'main', 'default')),
      'force-app/main/default'
    ).to.equal(true);
    expect(tree.isDirectory(classesPath), classesPath).to.equal(true);
    expect(tree.readDirectory(classesPath)).to.deep.equal([
      'TestOrderController.cls',
      'TestOrderController.cls-meta.xml',
    ]);
  });

  it('tree resolves to a class', () => {
    const resolver = new MetadataResolver(undefined, tree);
    const resolved = resolver.getComponentsFromPath('force-app');
    expect(resolved.length).to.equal(1);
    expect(resolved[0].type.name).to.equal('ApexClass');
  });
});
