/*
 * Copyright 2025, Salesforce, Inc.
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
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { assert, expect } from 'chai';
import { RegistryAccess, registry, VirtualTreeContainer, ForceIgnore, SourceComponent } from '../../../src';
import {
  DigitalExperienceSourceAdapter,
  computeWebAppHashedName,
} from '../../../src/resolve/adapters/digitalExperienceSourceAdapter';
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

  describe('DigitalExperienceSourceAdapter for web_app base type', () => {
    const WEBAPP_BUNDLE_PATH = join(BASE_PATH, 'web_app', 'zenith');
    const WEBAPP_CSS_FILE = join(WEBAPP_BUNDLE_PATH, 'css', 'home.css');

    const webappTree = VirtualTreeContainer.fromFilePaths([WEBAPP_CSS_FILE]);

    const webappBundleAdapter = new DigitalExperienceSourceAdapter(
      registry.types.digitalexperiencebundle,
      registryAccess,
      forceIgnore,
      webappTree
    );

    it('should return a SourceComponent for web_app bundle directory (no meta.xml required)', () => {
      const component = webappBundleAdapter.getComponent(WEBAPP_BUNDLE_PATH);
      expect(component).to.not.be.undefined;
      expect(component?.type.name).to.equal('DigitalExperienceBundle');
      expect(component?.fullName).to.equal('web_app/zenith');
      expect(component?.content).to.equal(WEBAPP_BUNDLE_PATH);
    });
  });

  describe('computeWebAppHashedName', () => {
    it('should compute hash for nested file', () => {
      const filePath = join('path', 'to', 'digitalExperiences', 'web_app', 'dist2', 'assets', 'icon.png');
      const bundleDir = join('path', 'to', 'digitalExperiences', 'web_app', 'dist2');
      const hashedName = computeWebAppHashedName(filePath, bundleDir);

      // Verify format: web_app/dist2.sfdc_cms__image/m<hash>
      expect(hashedName).to.match(/^web_app\/dist2\.sfdc_cms__image\/m[0-9a-f]{39}$/);

      // Verify the hash is computed from the FULL path: 'web_app/dist2/assets/icon.png'
      const expectedHash = createHash('sha256').update('web_app/dist2/assets/icon.png', 'utf8').digest('hex').substring(0, 39);
      expect(hashedName).to.equal(`web_app/dist2.sfdc_cms__image/m${expectedHash}`);
    });

    it('should compute hash for root-level file', () => {
      const filePath = join('path', 'to', 'digitalExperiences', 'web_app', 'dist2', '404.html');
      const bundleDir = join('path', 'to', 'digitalExperiences', 'web_app', 'dist2');
      const hashedName = computeWebAppHashedName(filePath, bundleDir);

      // Verify format: web_app/dist2.sfdc_cms__webApplicationAsset/m<hash>
      expect(hashedName).to.match(/^web_app\/dist2\.sfdc_cms__webApplicationAsset\/m[0-9a-f]{39}$/);

      // Verify the hash is computed from the FULL path: 'web_app/dist2/404.html'
      const expectedHash = createHash('sha256').update('web_app/dist2/404.html', 'utf8').digest('hex').substring(0, 39);
      expect(hashedName).to.equal(`web_app/dist2.sfdc_cms__webApplicationAsset/m${expectedHash}`);
    });

    it('should use correct content type for images (BMP, GIF, PNG, JPG, JPEG only)', () => {
      const pngFile = join('path', 'to', 'digitalExperiences', 'web_app', 'dist2', 'icon.png');
      const jpgFile = join('path', 'to', 'digitalExperiences', 'web_app', 'dist2', 'photo.jpg');
      const gifFile = join('path', 'to', 'digitalExperiences', 'web_app', 'dist2', 'animation.gif');
      const bmpFile = join('path', 'to', 'digitalExperiences', 'web_app', 'dist2', 'image.bmp');
      const bundleDir = join('path', 'to', 'digitalExperiences', 'web_app', 'dist2');

      expect(computeWebAppHashedName(pngFile, bundleDir)).to.include('sfdc_cms__image');
      expect(computeWebAppHashedName(jpgFile, bundleDir)).to.include('sfdc_cms__image');
      expect(computeWebAppHashedName(gifFile, bundleDir)).to.include('sfdc_cms__image');
      expect(computeWebAppHashedName(bmpFile, bundleDir)).to.include('sfdc_cms__image');
    });

    it('should use correct content type for web assets (including SVG, WebP, ICO)', () => {
      const jsFile = join('path', 'to', 'digitalExperiences', 'web_app', 'dist2', 'main.js');
      const cssFile = join('path', 'to', 'digitalExperiences', 'web_app', 'dist2', 'styles.css');
      const htmlFile = join('path', 'to', 'digitalExperiences', 'web_app', 'dist2', 'index.html');
      const jsonFile = join('path', 'to', 'digitalExperiences', 'web_app', 'dist2', 'data.json');
      const svgFile = join('path', 'to', 'digitalExperiences', 'web_app', 'dist2', 'icon.svg');
      const webpFile = join('path', 'to', 'digitalExperiences', 'web_app', 'dist2', 'photo.webp');
      const icoFile = join('path', 'to', 'digitalExperiences', 'web_app', 'dist2', 'favicon.ico');
      const bundleDir = join('path', 'to', 'digitalExperiences', 'web_app', 'dist2');

      expect(computeWebAppHashedName(jsFile, bundleDir)).to.include('sfdc_cms__webApplicationAsset');
      expect(computeWebAppHashedName(cssFile, bundleDir)).to.include('sfdc_cms__webApplicationAsset');
      expect(computeWebAppHashedName(htmlFile, bundleDir)).to.include('sfdc_cms__webApplicationAsset');
      expect(computeWebAppHashedName(jsonFile, bundleDir)).to.include('sfdc_cms__webApplicationAsset');
      expect(computeWebAppHashedName(svgFile, bundleDir)).to.include('sfdc_cms__webApplicationAsset');
      expect(computeWebAppHashedName(webpFile, bundleDir)).to.include('sfdc_cms__webApplicationAsset');
      expect(computeWebAppHashedName(icoFile, bundleDir)).to.include('sfdc_cms__webApplicationAsset');
    });

    it('should use correct content type for webapp.json only', () => {
      const webappFile = join('path', 'to', 'digitalExperiences', 'web_app', 'dist2', 'webapp.json');
      const manifestFile = join('path', 'to', 'digitalExperiences', 'web_app', 'dist2', 'manifest.json');
      const bundleDir = join('path', 'to', 'digitalExperiences', 'web_app', 'dist2');

      // webapp.json is special
      expect(computeWebAppHashedName(webappFile, bundleDir)).to.include('sfdc_cms__webApplicationManifest');
      
      // manifest.json is treated as regular web asset
      expect(computeWebAppHashedName(manifestFile, bundleDir)).to.include('sfdc_cms__webApplicationAsset');
    });

    it('should use correct content type for manifest.json', () => {
      const manifestFile = join('path', 'to', 'digitalExperiences', 'web_app', 'dist2', 'manifest.json');
      const otherJsonFile = join('path', 'to', 'digitalExperiences', 'web_app', 'dist2', 'config.json');
      const bundleDir = join('path', 'to', 'digitalExperiences', 'web_app', 'dist2');

      expect(computeWebAppHashedName(manifestFile, bundleDir)).to.include('sfdc_cms__webApplicationManifest');
      expect(computeWebAppHashedName(otherJsonFile, bundleDir)).to.include('sfdc_cms__webApplicationAsset');
    });
  });

  describe('DigitalExperienceSourceAdapter for web_app child files', () => {
    const WEBAPP_BUNDLE_PATH = join(BASE_PATH, 'web_app', 'dist2');
    const WEBAPP_ICON_FILE = join(WEBAPP_BUNDLE_PATH, 'assets', 'icon.png');
    const WEBAPP_404_FILE = join(WEBAPP_BUNDLE_PATH, '404.html');

    const webappTree = VirtualTreeContainer.fromFilePaths([WEBAPP_ICON_FILE, WEBAPP_404_FILE]);

    assert(registry.types.digitalexperiencebundle.children?.types.digitalexperience);
    const webappChildAdapter = new DigitalExperienceSourceAdapter(
      registry.types.digitalexperiencebundle.children.types.digitalexperience,
      registryAccess,
      forceIgnore,
      webappTree
    );

    it('should create child component with hashed name for nested file', () => {
      const component = webappChildAdapter.getComponent(WEBAPP_ICON_FILE);
      expect(component).to.not.be.undefined;
      expect(component?.type.name).to.equal('DigitalExperience');

      // Verify hashed name format - hash is computed from FULL path 'web_app/dist2/assets/icon.png'
      const expectedHash = createHash('sha256').update('web_app/dist2/assets/icon.png', 'utf8').digest('hex').substring(0, 39);
      expect(component?.fullName).to.equal(`web_app/dist2.sfdc_cms__image/m${expectedHash}`);

      // Verify parent
      expect(component?.parent?.type.name).to.equal('DigitalExperienceBundle');
      expect(component?.parent?.fullName).to.equal('web_app/dist2');
    });

    it('should create child component with hashed name for root file', () => {
      const component = webappChildAdapter.getComponent(WEBAPP_404_FILE);
      expect(component).to.not.be.undefined;
      expect(component?.type.name).to.equal('DigitalExperience');

      // Verify hashed name format - hash is computed from FULL path 'web_app/dist2/404.html'
      const expectedHash = createHash('sha256').update('web_app/dist2/404.html', 'utf8').digest('hex').substring(0, 39);
      expect(component?.fullName).to.equal(`web_app/dist2.sfdc_cms__webApplicationAsset/m${expectedHash}`);

      // Verify parent
      expect(component?.parent?.type.name).to.equal('DigitalExperienceBundle');
      expect(component?.parent?.fullName).to.equal('web_app/dist2');
    });
  });
});
