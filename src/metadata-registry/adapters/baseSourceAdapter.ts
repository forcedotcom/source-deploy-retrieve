/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  SourceAdapter,
  MetadataComponent,
  MetadataType,
  MetadataRegistry,
  SourcePath,
  MetadataXml
} from '../../types';
import { parseMetadataXml } from '../../utils/registry';
import * as registryData from '../data/registry.json';
import { RegistryError, UnexpectedForceIgnore } from '../../errors';
import { parentName } from '../../utils/path';
import { ForceIgnore } from '../forceIgnore';
import { dirname, basename } from 'path';

export abstract class BaseSourceAdapter implements SourceAdapter {
  protected type: MetadataType;
  protected registry: MetadataRegistry;
  protected forceIgnore: ForceIgnore;

  /**
   * Whether or not the adapter should expect a component to be in its own, self-contained folder.
   */
  protected ownFolder = false;

  constructor(
    type: MetadataType,
    registry: MetadataRegistry = registryData,
    forceIgnore: ForceIgnore = new ForceIgnore()
  ) {
    this.type = type;
    this.registry = registry;
    this.forceIgnore = forceIgnore;
  }

  public getComponent(path: SourcePath): MetadataComponent {
    const metaXml =
      this.parseAsRootMetadataXml(path) || parseMetadataXml(this.getRootMetadataXmlPath(path));
    if (!metaXml) {
      throw new RegistryError('error_missing_metadata_xml', [path, this.type.name]);
    } else if (this.forceIgnore.denies(metaXml.path)) {
      throw new UnexpectedForceIgnore('error_no_metadata_xml_ignore', [metaXml.path, path]);
    }

    const component: MetadataComponent = {
      fullName: this.type.inFolder
        ? `${parentName(metaXml.path)}/${metaXml.fullName}`
        : metaXml.fullName,
      type: this.type,
      xml: metaXml.path
    };

    return this.populate(component, path);
  }

  /**
   * Override this method to determine the related root metadata xml when
   * given a path that isn't to a metadata xml.
   *
   * @param component Component to populate properties on
   * @param trigger Path that `SourceAdapter.getComponent` was called with
   */
  protected abstract getRootMetadataXmlPath(trigger: SourcePath): SourcePath;

  /**
   * Override this method to populate additional properties on a MetadataComponent, such
   * as source files and child components.
   *
   * @param component Component to populate properties on
   * @param trigger Path that `SourceAdapter.getComponent` was called with
   */
  protected abstract populate(component: MetadataComponent, trigger: SourcePath): MetadataComponent;

  /**
   * If the given path is the root metadata xml file for the component,
   * parse the name and return it. This is an optimization to not make a child
   * source adapter do anymore work to find the root xml if it was the path that
   * was passed to `getComponent`.
   *
   * @param path File path of a metadata component
   */
  private parseAsRootMetadataXml(path: SourcePath): MetadataXml {
    let isRootMetadataXml = false;
    const metaXml = parseMetadataXml(path);
    if (metaXml) {
      const requireStrictParent = !!this.registry.mixedContent[this.type.directoryName];
      if (requireStrictParent) {
        let rootTypePath = dirname(path);
        rootTypePath = this.ownFolder ? dirname(rootTypePath) : rootTypePath;
        rootTypePath = this.type.inFolder ? dirname(rootTypePath) : rootTypePath;
        isRootMetadataXml = basename(rootTypePath) === this.type.directoryName;
      } else {
        isRootMetadataXml = true;
      }
    }
    return isRootMetadataXml ? metaXml : undefined;
  }
}
