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
  SourcePath
} from '../../types';
import { parseMetadataXml } from '../../utils/registry';
import { basename, dirname } from 'path';
import * as registryData from '../data/registry.json';
import { RegistryError, UnexpectedForceIgnore } from '../../errors';
import { parentName } from '../../utils/path';
import { ForceIgnore } from '../forceIgnore';

/**
 * The default source adapter.
 *
 * Direct usage of this adapter is for simple types with no additional content.
 * Unless there's a particular reason not to, other adapters will extend this one.
 * It handles shared functionality amongst the other adapters.
 *
 * __Example Types__:
 *
 * Layouts, PermissionSets, FlexiPages
 *
 * __Example Structure__:
 * ```text
 * foos/
 * ├── foo.ext-meta.xml
 * ├── bar.ext-meta.xml
 *```
 */
export class BaseSourceAdapter implements SourceAdapter {
  protected type: MetadataType;
  protected registry: MetadataRegistry;
  protected forceIgnore: ForceIgnore;

  constructor(
    type: MetadataType,
    registry: MetadataRegistry = registryData,
    forceIgnore: ForceIgnore = new ForceIgnore()
  ) {
    this.type = type;
    this.registry = registry;
    this.forceIgnore = forceIgnore;
  }

  /**
   * At the time of writing, Typescript does not have a `final` keyword so
   * nothing is stopping you from overriding this method. It's best if you don't
   * because this handles shared functionality across adapters. If you must,
   * create a new implementation of `SourceAdapter`.
   *
   * @param fsPath File path for a piece of metadata
   */
  public getComponent(fsPath: SourcePath): MetadataComponent {
    let metaXmlPath = fsPath;
    let isMetaXml = true;
    let parsedMetaXml = parseMetadataXml(fsPath);

    // If the path is not a metadata xml, or the metadata xml is not in the root
    // of the type directory, defer fetching the file to the child adapter
    const rootTypePath = dirname(this.type.inFolder ? dirname(fsPath) : fsPath);
    const inRootTypeFolder = basename(rootTypePath) === this.type.directoryName;
    const requireStrictParent = !!this.registry.mixedContent[this.type.directoryName];
    if (!parsedMetaXml || (requireStrictParent && !inRootTypeFolder)) {
      metaXmlPath = this.getMetadataXmlPath(fsPath);
      if (!metaXmlPath) {
        throw new RegistryError('error_missing_metadata_xml', [fsPath, this.type.name]);
      }
      parsedMetaXml = parseMetadataXml(metaXmlPath);
      isMetaXml = false;
    }

    if (this.forceIgnore.denies(metaXmlPath)) {
      throw new UnexpectedForceIgnore('error_no_metadata_xml_ignore', [metaXmlPath, fsPath]);
    }

    // TODO: Rework pattern for populating a component.
    const component: MetadataComponent = {
      fullName: parsedMetaXml.fullName,
      type: this.type,
      xml: metaXmlPath
    };
    const sources = this.getSourcePaths(fsPath, isMetaXml);
    const children = this.getChildren(metaXmlPath);
    if (sources) {
      component.sources = sources;
    }
    if (children) {
      component.children = children;
    }

    if (this.type.inFolder) {
      component.fullName = `${parentName(component.xml)}/${component.fullName}`;
    }

    return component;
  }

  /**
   * Override this method to tell the adapter how to locate a component's
   * root metadata xml file.
   *
   * @param pathToSource Path to a non root metadata xml file
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected getMetadataXmlPath(pathToSource: SourcePath): SourcePath | undefined {
    return undefined;
  }

  /**
   * Override this method to tell the adapter how to locate a component's
   * source files.
   *
   * @param fsPath File path to base the inference of other source files
   * @param isMetaXml Whether or not the provided file path is a root metadata xml file
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected getSourcePaths(fsPath: SourcePath, isMetaXml: boolean): SourcePath[] {
    return undefined;
  }

  /**
   * Override this method to tell the adapter how to locate child components.
   *
   * @param xmlPath Path to root metadata xml
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected getChildren(xmlPath: SourcePath): MetadataComponent[] | undefined {
    return undefined;
  }
}
