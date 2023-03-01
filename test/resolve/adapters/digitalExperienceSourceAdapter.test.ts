/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { join } from 'path';
import { expect } from 'chai';
import { RegistryAccess, registry, VirtualTreeContainer, ForceIgnore, SourceComponent } from '../../../src';
import { DigitalExperienceSourceAdapter } from '../../../src/resolve/adapters/digitalExperienceSourceAdapter';
import { META_XML_SUFFIX, META_JSON_FILE } from '../../../src/common';

describe('DigitalExperienceSourceAdapter', () => {
  const BASE_PATH = join('path', 'to', registry.types.digitalexperiencebundle.directoryName);

  const BUNDLE_NAME = join('site', 'foo');
  const BUNDLE_PATH = join(BASE_PATH, BUNDLE_NAME);
  const BUNDLE_META_FILE = join(BUNDLE_PATH, `foo.${registry.types.digitalexperiencebundle.suffix}${META_XML_SUFFIX}`);

  const HOME_VIEW_NAME = join('sfdc_cms__view', 'home');
  const HOME_VIEW_PATH = join(BUNDLE_PATH, HOME_VIEW_NAME);
  const HOME_VIEW_CONTENT_FILE = join(HOME_VIEW_PATH, 'content.json');
  const HOME_VIEW_META_FILE = join(HOME_VIEW_PATH, META_JSON_FILE);
  const HOME_VIEW_FRENCH_VARIANT_FILE = join(HOME_VIEW_PATH, 'fr.json');

  const registryAccess = new RegistryAccess();
  const forceIgnore = new ForceIgnore();
  const tree = VirtualTreeContainer.fromFilePaths([
    BUNDLE_META_FILE,
    HOME_VIEW_CONTENT_FILE,
    HOME_VIEW_META_FILE,
    HOME_VIEW_FRENCH_VARIANT_FILE,
  ]);

  const bundleAdapter = new DigitalExperienceSourceAdapter(
    registry.types.digitalexperiencebundle,
    registryAccess,
    forceIgnore,
    tree
  );

  const digitalExperienceAdapter = new DigitalExperienceSourceAdapter(
    registry.types.digitalexperiencebundle.children.types.digitalexperience,
    registryAccess,
    forceIgnore,
    tree
  );

  describe('DigitalExperienceSourceAdapter for DEB', () => {
    const component = new SourceComponent(
      {
        name: BUNDLE_NAME,
        type: registry.types.digitalexperiencebundle,
        xml: BUNDLE_META_FILE,
      },
      tree
    );

    it('should return a SourceComponent for meta xml', () => {
      expect(bundleAdapter.getComponent(BUNDLE_META_FILE)).to.deep.equal(component);
    });

    it('should return a SourceComponent for content and variant json', () => {
      expect(bundleAdapter.getComponent(HOME_VIEW_CONTENT_FILE)).to.deep.equal(component);
      expect(bundleAdapter.getComponent(HOME_VIEW_META_FILE)).to.deep.equal(component);
      expect(bundleAdapter.getComponent(HOME_VIEW_FRENCH_VARIANT_FILE)).to.deep.equal(component);
    });

    it('should return a SourceComponent when a bundle path is provided', () => {
      expect(bundleAdapter.getComponent(HOME_VIEW_PATH)).to.deep.equal(component);
      expect(bundleAdapter.getComponent(BUNDLE_PATH)).to.deep.equal(component);
    });
  });

  describe('DigitalExperienceSourceAdapter for DE', () => {
    const component = new SourceComponent(
      {
        name: HOME_VIEW_NAME,
        type: registry.types.digitalexperiencebundle.children.types.digitalexperience,
        content: HOME_VIEW_PATH,
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

    it('should return a SourceComponent for content and variant json', () => {
      expect(digitalExperienceAdapter.getComponent(HOME_VIEW_CONTENT_FILE)).to.deep.equal(component);
      expect(digitalExperienceAdapter.getComponent(HOME_VIEW_META_FILE)).to.deep.equal(component);
      expect(digitalExperienceAdapter.getComponent(HOME_VIEW_FRENCH_VARIANT_FILE)).to.deep.equal(component);
    });
  });
});
