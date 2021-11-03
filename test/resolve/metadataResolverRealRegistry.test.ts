/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { join } from 'path';
import { expect } from 'chai';

import { MetadataResolver, SourceComponent, VirtualTreeContainer } from '../../src/resolve';
import { META_XML_SUFFIX } from '../../src/common';
import { registry, RegistryAccess } from '../../src';

describe('MetadataResolver', () => {
  const registryAccess = new RegistryAccess(registry);
  describe('Should not resolve using strictDir when suffixes do not match', () => {
    const type = registryAccess.getTypeByName('ApexClass');
    const COMPONENT_NAMES = ['myClass'];
    // real scenario: classes/foo/objects/myCls.cls (where objects is the strictDir of another type)
    const TYPE_DIRECTORY = join('classes', 'subfolder', 'subfolder2', 'objects');
    const XML_NAMES = COMPONENT_NAMES.map((name) => `${name}.${type.suffix}${META_XML_SUFFIX}`);
    const XML_PATHS = XML_NAMES.map((name) => join(TYPE_DIRECTORY, name));
    const CONTENT_NAMES = COMPONENT_NAMES.map((name) => `${name}.${type.suffix}`);
    const CONTENT_PATHS = CONTENT_NAMES.map((name) => join(TYPE_DIRECTORY, name));
    const TREE = new VirtualTreeContainer([
      {
        dirPath: TYPE_DIRECTORY,
        children: XML_NAMES.concat(CONTENT_NAMES),
      },
    ]);
    const COMPONENTS = COMPONENT_NAMES.map(
      (name, index) =>
        new SourceComponent(
          {
            name,
            type,
            xml: XML_PATHS[index],
            content: CONTENT_PATHS[index],
          },
          TREE
        )
    );
    it('metadata file', () => {
      const resolver = new MetadataResolver(registryAccess, TREE);
      const sourceComponent = resolver.getComponentsFromPath(XML_PATHS[0])[0];
      expect(sourceComponent.type).to.deep.equal(type);
      expect(sourceComponent).to.deep.equal(COMPONENTS[0]);
    });
    it('content file', () => {
      const resolver = new MetadataResolver(registryAccess, TREE);
      expect(resolver.getComponentsFromPath(CONTENT_PATHS[0])).to.deep.equal([COMPONENTS[0]]);
    });
  });
});
