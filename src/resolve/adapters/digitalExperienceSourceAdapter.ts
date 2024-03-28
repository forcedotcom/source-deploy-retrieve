/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { dirname, join, sep } from 'node:path';
import { Messages } from '@salesforce/core';
import { META_XML_SUFFIX } from '../../common/constants';
import { SourcePath } from '../../common/types';
import { SourceComponent } from '../sourceComponent';
import { MetadataXml } from '../types';
import { baseName, parentName } from '../../utils/path';
import { BundleSourceAdapter } from './bundleSourceAdapter';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/source-deploy-retrieve', 'sdr');
/**
 * Source Adapter for DigitalExperience metadata types. This metadata type is a bundled type of the format
 *
 * __Example Structure__:
 *
 *```text
 * site/
 * ├── foos/
 * |   ├── sfdc_cms__appPage/
 * |   |   ├── mainAppPage/
 * |   |   |  ├── _meta.json
 * |   |   |  ├── content.json
 * |   ├── sfdc_cms__view/
 * |   |   ├── view1/
 * |   |   |  ├── _meta.json
 * |   |   |  ├── content.json
 * |   |   |  ├── fr.json
 * |   |   |  ├── en.json
 * |   |   ├── view2/
 * |   |   |  ├── _meta.json
 * |   |   |  ├── content.json
 * |   |   |  ├── ar.json
 * |   |   ├── view3/
 * |   |   |  ├── _meta.json
 * |   |   |  ├── content.json
 * |   |   |  ├── mobile/
 * |   |   |  |   ├──mobile.json
 * |   |   |  ├── tablet/
 * |   |   |  |   ├──tablet.json
 * |   ├── foos.digitalExperience-meta.xml
 * content/
 * ├── bars/
 * |   ├── bars.digitalExperience-meta.xml
 * ```
 *
 * In the above structure the metadata xml file ending with "digitalExperience-meta.xml" belongs to DigitalExperienceBundle MD type.
 * The "_meta.json" files are child metadata files of DigitalExperienceBundle belonging to DigitalExperience MD type. The rest of the files in the
 * corresponding folder are the contents to the DigitalExperience metadata. So, incase of DigitalExperience the metadata file is a JSON file
 * and not an XML file
 */
export class DigitalExperienceSourceAdapter extends BundleSourceAdapter {
  protected getRootMetadataXmlPath(trigger: string): string {
    if (this.isBundleType()) {
      return this.getBundleMetadataXmlPath(trigger);
    }
    // metafile name = metaFileSuffix for DigitalExperience.
    if (!this.type.metaFileSuffix) {
      throw messages.createError('missingMetaFileSuffix', [this.type.name]);
    }
    return join(dirname(trigger), this.type.metaFileSuffix);
  }

  protected trimPathToContent(path: string): string {
    if (this.isBundleType()) {
      return path;
    }
    const pathToContent = dirname(path);
    const parts = pathToContent.split(sep);
    /* Handle mobile or tablet variants.Eg- digitalExperiences/site/lwr11/sfdc_cms__view/home/mobile/mobile.json
     Go back to one level in that case
     Bundle hierarchy baseType/spaceApiName/contentType/contentApiName/variantFolders/file */
    const digitalExperiencesIndex = parts.indexOf('digitalExperiences');
    if (digitalExperiencesIndex > -1) {
      const depth = parts.length - digitalExperiencesIndex - 1;
      if (depth === digitalExperienceBundleWithVariantsDepth) {
        parts.pop();
        return parts.join(sep);
      }
    }
    return pathToContent;
  }

  protected populate(trigger: string, component?: SourceComponent): SourceComponent {
    if (this.isBundleType() && component) {
      // for top level types we don't need to resolve parent
      return component;
    }
    const source = super.populate(trigger, component);
    const parentType = this.registry.getParentType(this.type.id);
    // we expect source, parentType and content to be defined.
    if (!source || !parentType || !source.content) {
      throw messages.createError('error_failed_convert', [component?.fullName ?? this.type.name]);
    }
    const parent = new SourceComponent(
      {
        name: this.getBundleName(source.content),
        type: parentType,
        xml: this.getBundleMetadataXmlPath(source.content),
      },
      this.tree,
      this.forceIgnore
    );
    return new SourceComponent(
      {
        name: calculateNameFromPath(source.content),
        type: this.type,
        content: source.content,
        xml: source.xml,
        parent,
        parentType,
      },
      this.tree,
      this.forceIgnore
    );
  }

  protected parseMetadataXml(path: SourcePath): MetadataXml | undefined {
    const xml = super.parseMetadataXml(path);
    if (xml) {
      return {
        fullName: this.getBundleName(path),
        suffix: xml.suffix,
        path: xml.path,
      };
    }
  }

  private getBundleName(contentPath: string): string {
    const bundlePath = this.getBundleMetadataXmlPath(contentPath);
    return `${parentName(dirname(bundlePath))}/${parentName(bundlePath)}`;
  }

  private getBundleMetadataXmlPath(path: string): string {
    if (this.isBundleType() && path.endsWith(META_XML_SUFFIX)) {
      // if this is the bundle type and it ends with -meta.xml, then this is the bundle metadata xml path
      return path;
    }
    const pathParts = path.split(sep);
    const typeFolderIndex = pathParts.lastIndexOf(this.type.directoryName);
    // 3 because we want 'digitalExperiences' directory, 'baseType' directory and 'bundleName' directory
    const basePath = pathParts.slice(0, typeFolderIndex + 3).join(sep);
    const bundleFileName = pathParts[typeFolderIndex + 2];
    const suffix = this.isBundleType() ? this.type.suffix : this.registry.getParentType(this.type.id)?.suffix;
    return `${basePath}${sep}${bundleFileName}.${suffix}${META_XML_SUFFIX}`;
  }

  private isBundleType(): boolean {
    return this.type.id === 'digitalexperiencebundle';
  }
}

/**
 * @param contentPath This hook is called only after trimPathToContent() is called. so this will always be a folder structure
 * @returns name of type/apiName format
 */
const calculateNameFromPath = (contentPath: string): string => `${parentName(contentPath)}/${baseName(contentPath)}`;

// Bundle hierarchy baseType/spaceApiName/contentType/contentApiName/variantFolders/file
const digitalExperienceBundleWithVariantsDepth = 5;
