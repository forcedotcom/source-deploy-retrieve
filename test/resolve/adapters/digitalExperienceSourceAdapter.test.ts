/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { join } from 'node:path';
import { assert, expect } from 'chai';
import { RegistryAccess, registry, VirtualTreeContainer, ForceIgnore, SourceComponent } from '../../../src';
import { getDigitalExperienceComponent } from '../../../src/resolve/adapters/digitalExperienceSourceAdapter';
import { META_XML_SUFFIX } from '../../../src/common';
import { DE_METAFILE } from '../../mock/type-constants/digitalExperienceBundleConstants';

describe('DigitalExperienceSourceAdapter', () => {
  const BASE_PATH = join('path', 'to', registry.types.digitalexperiencebundle.directoryName);

  const BUNDLE_NAME = 'site/foo';
  const BUNDLE_PATH = join(BASE_PATH, 'site', 'foo');
  const BUNDLE_META_FILE = join(BUNDLE_PATH, `foo.${registry.types.digitalexperiencebundle.suffix}${META_XML_SUFFIX}`);

  const HOME_VIEW_NAME = 'sfdc_cms__view/home';
  const HOME_VIEW_PATH = join(BUNDLE_PATH, 'sfdc_cms__view', 'home');
  const HOME_VIEW_MOBILE_PATH = join(HOME_VIEW_PATH, 'mobile');
  const HOME_VIEW_TABLET_PATH = join(HOME_VIEW_PATH, 'tablet');

  const HOME_VIEW_CONTENT_FILE = join(HOME_VIEW_PATH, 'content.json');
  assert(typeof DE_METAFILE === 'string');
  const HOME_VIEW_META_FILE = join(HOME_VIEW_PATH, DE_METAFILE);
  const HOME_VIEW_FRENCH_VARIANT_FILE = join(HOME_VIEW_PATH, 'fr.json');
  const HOME_VIEW_MOBILE_VARIANT_FILE = join(HOME_VIEW_MOBILE_PATH, 'mobile.json');
  const HOME_VIEW_TABLET_VARIANT_FILE = join(HOME_VIEW_TABLET_PATH, 'tablet.json');

  const registryAccess = new RegistryAccess();
  const forceIgnore = new ForceIgnore();
  const tree = VirtualTreeContainer.fromFilePaths([
    BUNDLE_META_FILE,
    HOME_VIEW_CONTENT_FILE,
    HOME_VIEW_META_FILE,
    HOME_VIEW_FRENCH_VARIANT_FILE,
    HOME_VIEW_MOBILE_VARIANT_FILE,
    HOME_VIEW_TABLET_VARIANT_FILE,
  ]);

  assert(registry.types.digitalexperiencebundle.children?.types.digitalexperience);

  describe('DigitalExperienceSourceAdapter for DEB', () => {
    const adapter = getDigitalExperienceComponent({ tree, registry: registryAccess });

    const type = registry.types.digitalexperiencebundle;
    const component = new SourceComponent(
      {
        name: BUNDLE_NAME,
        type,
        xml: BUNDLE_META_FILE,
      },
      tree
    );

    it('should return a SourceComponent for meta xml', () => {
      expect(adapter({ type, path: BUNDLE_META_FILE })).to.deep.equal(component);
    });

    it('should return a SourceComponent for content and variant json', () => {
      expect(adapter({ type, path: HOME_VIEW_CONTENT_FILE })).to.deep.equal(component);
      expect(adapter({ type, path: HOME_VIEW_META_FILE })).to.deep.equal(component);
      expect(adapter({ type, path: HOME_VIEW_FRENCH_VARIANT_FILE })).to.deep.equal(component);
    });

    it('should return a SourceComponent for mobile and tablet variant json', () => {
      expect(adapter({ type, path: HOME_VIEW_MOBILE_VARIANT_FILE })).to.deep.equal(component);
      expect(adapter({ type, path: HOME_VIEW_TABLET_VARIANT_FILE })).to.deep.equal(component);
    });

    it('should return a SourceComponent when a bundle path is provided', () => {
      expect(adapter({ type, path: HOME_VIEW_PATH })).to.deep.equal(component);
      expect(adapter({ type, path: BUNDLE_PATH })).to.deep.equal(component);
    });
  });

  describe('DigitalExperienceSourceAdapter for DE', () => {
    assert(registry.types.digitalexperiencebundle.children?.types.digitalexperience);
    const type = registry.types.digitalexperiencebundle.children?.types.digitalexperience;
    const component = new SourceComponent(
      {
        name: HOME_VIEW_NAME,
        type,
        content: HOME_VIEW_PATH,
        xml: HOME_VIEW_META_FILE,
        parent: new SourceComponent(
          {
            name: BUNDLE_NAME,
            type: registry.types.digitalexperiencebundle,
            xml: BUNDLE_META_FILE,
          },
          tree,
          forceIgnore
        ),
        parentType: registry.types.digitalexperiencebundle,
      },
      tree,
      forceIgnore
    );

    const adapter = getDigitalExperienceComponent({ tree, registry: registryAccess });

    it('should return a SourceComponent for content and variant json', () => {
      expect(adapter({ type, path: HOME_VIEW_CONTENT_FILE })).to.deep.equal(component);
      expect(adapter({ type, path: HOME_VIEW_META_FILE })).to.deep.equal(component);
      expect(adapter({ type, path: HOME_VIEW_FRENCH_VARIANT_FILE })).to.deep.equal(component);
    });

    it('should return a SourceComponent for mobile and tablet variant json', () => {
      expect(adapter({ type, path: HOME_VIEW_MOBILE_VARIANT_FILE })).to.deep.equal(component);
      expect(adapter({ type, path: HOME_VIEW_TABLET_VARIANT_FILE })).to.deep.equal(component);
    });
  });
});
