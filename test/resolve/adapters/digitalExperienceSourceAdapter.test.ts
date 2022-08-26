/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { join } from 'path';
import { expect } from 'chai';
import {
  RegistryAccess,
  registry,
  VirtualTreeContainer,
  ForceIgnore,
  SourceComponent,
  MetadataXml,
} from '../../../src';
import { DigitalExperienceSourceAdapter } from '../../../src/resolve/adapters/digitalExperienceSourceAdapter';
import { META_XML_SUFFIX } from '../../../src/common';

describe('DigitalExperienceSourceAdapter', () => {
  /**
   * Stub class used for unit testing protected methods
   */
  class DigitalExperienceSourceAdapterStub extends DigitalExperienceSourceAdapter {
    public getRootMetadataXmlPath(trigger: string): string {
      return super.getRootMetadataXmlPath(trigger);
    }
    public calculateNameFromPath(contentPath: string): string {
      return super.calculateNameFromPath(contentPath);
    }
    public trimPathToContent(path: string): string {
      return super.trimPathToContent(path);
    }
    public populate(trigger: string, component?: SourceComponent): SourceComponent {
      return super.populate(trigger, component);
    }
    public parseMetadataXml(path: string): MetadataXml {
      return super.parseMetadataXml(path);
    }
  }

  const BASE_PATH = join('path', 'to', registry.types.digitalexperiencebundle.directoryName);

  const BUNDLE_NAME = join('site', 'foo');
  const BUNDLE_PATH = join(BASE_PATH, BUNDLE_NAME);
  const BUNDLE_META_FILE = join(BUNDLE_PATH, `foo.${registry.types.digitalexperiencebundle.suffix}${META_XML_SUFFIX}`);

  const HOME_VIEW_NAME = join('sfdc_cms__view', 'home');
  const HOME_VIEW_PATH = join(BUNDLE_PATH, HOME_VIEW_NAME);
  const HOME_VIEW_CONTENT_FILE = join(HOME_VIEW_PATH, 'content.json');
  const HOME_VIEW_META_FILE = join(HOME_VIEW_PATH, '_meta.json');
  const HOME_VIEW_FRENCH_VARIANT_FILE = join(HOME_VIEW_PATH, 'fr.json');

  const registryAccess = new RegistryAccess();
  const forceIgnore = new ForceIgnore();
  const tree = VirtualTreeContainer.fromFilePaths([
    BUNDLE_META_FILE,
    HOME_VIEW_CONTENT_FILE,
    HOME_VIEW_META_FILE,
    HOME_VIEW_FRENCH_VARIANT_FILE,
  ]);

  const bundleAdapter = new DigitalExperienceSourceAdapterStub(
    registry.types.digitalexperiencebundle,
    registryAccess,
    forceIgnore,
    tree
  );

  const digitalExperienceAdapter = new DigitalExperienceSourceAdapterStub(
    registry.types.digitalexperiencebundle.children.types.digitalexperience,
    registryAccess,
    forceIgnore,
    tree
  );

  describe('getRootMetadataXmlPath', () => {
    it('should return metadata file for content.json', () => {
      expect(digitalExperienceAdapter.getRootMetadataXmlPath(HOME_VIEW_CONTENT_FILE)).to.be.equal(HOME_VIEW_META_FILE);
      expect(bundleAdapter.getRootMetadataXmlPath(HOME_VIEW_CONTENT_FILE)).to.be.equal(BUNDLE_META_FILE);
    });

    it('should return metadata file for variant file', () => {
      expect(digitalExperienceAdapter.getRootMetadataXmlPath(HOME_VIEW_FRENCH_VARIANT_FILE)).to.be.equal(
        HOME_VIEW_META_FILE
      );
      expect(bundleAdapter.getRootMetadataXmlPath(HOME_VIEW_FRENCH_VARIANT_FILE)).to.be.equal(BUNDLE_META_FILE);
    });

    it('should return metadata file for _meta.json file', () => {
      expect(digitalExperienceAdapter.getRootMetadataXmlPath(HOME_VIEW_META_FILE)).to.be.equal(HOME_VIEW_META_FILE);
      expect(bundleAdapter.getRootMetadataXmlPath(HOME_VIEW_META_FILE)).to.be.equal(BUNDLE_META_FILE);
    });

    it('should return metadata file for bundle', () => {
      expect(bundleAdapter.getRootMetadataXmlPath(BUNDLE_META_FILE)).to.be.equal(BUNDLE_META_FILE);
    });
  });

  describe('calculateNameFromPath', () => {
    it('should return content full name in proper format', () => {
      expect(digitalExperienceAdapter.calculateNameFromPath(HOME_VIEW_PATH)).to.be.equal(HOME_VIEW_NAME);
    });

    it('should return space full name in proper format', () => {
      expect(bundleAdapter.calculateNameFromPath(BUNDLE_PATH)).to.be.equal(BUNDLE_NAME);
    });
  });

  describe('trimPathToContent', () => {
    it('should get the content folder for contents', () => {
      expect(digitalExperienceAdapter.trimPathToContent(HOME_VIEW_CONTENT_FILE)).to.be.equal(HOME_VIEW_PATH);
      expect(digitalExperienceAdapter.trimPathToContent(HOME_VIEW_FRENCH_VARIANT_FILE)).to.be.equal(HOME_VIEW_PATH);
      expect(digitalExperienceAdapter.trimPathToContent(HOME_VIEW_META_FILE)).to.be.equal(HOME_VIEW_PATH);
    });

    it('returns undefined for DEB', () => {
      expect(bundleAdapter.trimPathToContent(BUNDLE_META_FILE)).to.be.undefined;
    });
  });

  describe('populate', () => {
    it('returns the same component for DEB', () => {
      const component = SourceComponent.createVirtualComponent({
        name: BUNDLE_NAME,
        type: registry.types.digitalexperiencebundle,
        xml: BUNDLE_META_FILE,
      });
      expect(bundleAdapter.populate('', component)).to.be.equal(component);
      expect(bundleAdapter.populate('', undefined)).to.be.undefined;
    });
  });

  it('constructs proper parent for contents', () => {
    const parent = new SourceComponent(
      {
        name: BUNDLE_NAME,
        type: registry.types.digitalexperiencebundle,
        xml: BUNDLE_META_FILE,
      },
      tree,
      forceIgnore
    );
    const component = new SourceComponent(
      {
        name: HOME_VIEW_NAME,
        type: registry.types.digitalexperiencebundle.children.types.digitalexperience,
        content: HOME_VIEW_PATH,
        parent,
        parentType: registry.types.digitalexperiencebundle,
      },
      tree,
      forceIgnore
    );
    expect(digitalExperienceAdapter.populate(HOME_VIEW_CONTENT_FILE, undefined)).to.deep.equal(component);
    expect(digitalExperienceAdapter.populate(HOME_VIEW_META_FILE, undefined)).to.deep.equal(component);
    expect(digitalExperienceAdapter.populate(HOME_VIEW_FRENCH_VARIANT_FILE, undefined)).to.deep.equal(component);
  });

  describe('parseMetadataXml', () => {
    it('returns proper name in MetadataXml', () => {
      const xml = {
        fullName: BUNDLE_NAME,
        suffix: registry.types.digitalexperiencebundle.suffix,
        path: BUNDLE_META_FILE,
      };
      expect(bundleAdapter.parseMetadataXml(BUNDLE_META_FILE)).to.deep.equal(xml);
    });
  });
});
