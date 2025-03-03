/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { join } from 'node:path';
import { assert, expect } from 'chai';
import { RegistryAccess, registry, VirtualTreeContainer, ForceIgnore, SourceComponent } from '../../../src';
import { DigitalExperienceSourceAdapter } from '../../../src/resolve/adapters/digitalExperienceSourceAdapter';
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

  const LWC_NAME = 'sfdc_cms__lwc/localComp';
  const LWC_PATH = join(BUNDLE_PATH, 'sfdc_cms__lwc', 'localComp');
  const LWC_META_FILE = join(LWC_PATH, DE_METAFILE);
  const LWC_CONTENT_FILE = join(LWC_PATH, 'content.json');
  const LWC_JS_META_XML_FILE = join(LWC_PATH, 'localComp.js-meta.xml');
  const LWC_JS_FILE = join(LWC_PATH, 'localComp.js');
  const LWC_HTML_FILE = join(LWC_PATH, 'localComp.html');
  const LWC_CSS_FILE = join(LWC_PATH, 'localComp.css');
  const LWC_EDITOR_JSON_FILE = join(LWC_PATH, 'editor.json');
  const LWC_SVG_FILE = join(LWC_PATH, 'localComp.svg');
  const LWC_NESTED_FOLDERS_HTML_FILE = join(LWC_PATH, 'folder1', 'folder1_1', 'folder1_1_1', 'compHelper.html');

  const registryAccess = new RegistryAccess();
  const forceIgnore = new ForceIgnore();
  const tree = VirtualTreeContainer.fromFilePaths([
    BUNDLE_META_FILE,
    HOME_VIEW_CONTENT_FILE,
    HOME_VIEW_META_FILE,
    HOME_VIEW_FRENCH_VARIANT_FILE,
    HOME_VIEW_MOBILE_VARIANT_FILE,
    HOME_VIEW_TABLET_VARIANT_FILE,
    LWC_META_FILE,
    LWC_CONTENT_FILE,
    LWC_JS_META_XML_FILE,
    LWC_JS_FILE,
    LWC_HTML_FILE,
    LWC_CSS_FILE,
    LWC_EDITOR_JSON_FILE,
    LWC_SVG_FILE,
    LWC_NESTED_FOLDERS_HTML_FILE,
  ]);

  const bundleAdapter = new DigitalExperienceSourceAdapter(
    registry.types.digitalexperiencebundle,
    registryAccess,
    forceIgnore,
    tree
  );

  assert(registry.types.digitalexperiencebundle.children?.types.digitalexperience);
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

    it('should return a SourceComponent for mobile and tablet variant json', () => {
      expect(bundleAdapter.getComponent(HOME_VIEW_MOBILE_VARIANT_FILE)).to.deep.equal(component);
      expect(bundleAdapter.getComponent(HOME_VIEW_TABLET_VARIANT_FILE)).to.deep.equal(component);
    });

    it('should return a SourceComponent when a bundle path is provided', () => {
      expect(bundleAdapter.getComponent(HOME_VIEW_PATH)).to.deep.equal(component);
      expect(bundleAdapter.getComponent(BUNDLE_PATH)).to.deep.equal(component);
    });
  });

  describe('DigitalExperienceSourceAdapter for DE', () => {
    assert(registry.types.digitalexperiencebundle.children?.types.digitalexperience);
    const component = new SourceComponent(
      {
        name: HOME_VIEW_NAME,
        type: registry.types.digitalexperiencebundle.children.types.digitalexperience,
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

    it('should return a SourceComponent for content and variant json', () => {
      expect(digitalExperienceAdapter.getComponent(HOME_VIEW_CONTENT_FILE)).to.deep.equal(component);
      expect(digitalExperienceAdapter.getComponent(HOME_VIEW_META_FILE)).to.deep.equal(component);
      expect(digitalExperienceAdapter.getComponent(HOME_VIEW_FRENCH_VARIANT_FILE)).to.deep.equal(component);
    });

    it('should return a SourceComponent for mobile and tablet variant json', () => {
      expect(digitalExperienceAdapter.getComponent(HOME_VIEW_MOBILE_VARIANT_FILE)).to.deep.equal(component);
      expect(digitalExperienceAdapter.getComponent(HOME_VIEW_TABLET_VARIANT_FILE)).to.deep.equal(component);
    });
  });

  describe('DigitalExperienceSourceAdapter for DE LWC Content', () => {
    assert(registry.types.digitalexperiencebundle.children?.types.digitalexperience);
    const component = new SourceComponent(
      {
        name: LWC_NAME,
        type: registry.types.digitalexperiencebundle.children.types.digitalexperience,
        content: LWC_PATH,
        xml: LWC_META_FILE,
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

    it('should return a SourceComponent for files in inline media content', () => {
      const files: string[] = [
        LWC_CONTENT_FILE,
        LWC_META_FILE,
        LWC_JS_META_XML_FILE,
        LWC_JS_FILE,
        LWC_HTML_FILE,
        LWC_CSS_FILE,
        LWC_EDITOR_JSON_FILE,
        LWC_SVG_FILE,
        LWC_NESTED_FOLDERS_HTML_FILE,
      ];
      files.forEach((file) => {
        expect(digitalExperienceAdapter.getComponent(file)).to.deep.equal(component);
      });
    });
  });
});
