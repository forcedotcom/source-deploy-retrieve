/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Messages, SfError } from '@salesforce/core';
import { SourcePath } from '../../common/types';
import { SourceComponent } from '../sourceComponent';
import { baseName, parentName, parseMetadataXml } from '../../utils/path';
import { MixedContentSourceAdapter } from './mixedContentSourceAdapter';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/source-deploy-retrieve', 'sdr');

/**
 * Handles type where children are grouped into a single file
 *
 * __Example Types__:
 *
 * DecomposedPermissionSetBeta2
 *
 * __Example Structure__:
 *
 * ```text
 *     ├─ PO_Manager
 *      │   ├─ objectSettings
 *      │   │   ├─ Account.objectSettings-meta.xml
 *      │   │   ├─ PO_Line_Item__c.objectSettings-meta.xml
 *      │   │   └─ Purchase_Order__c.objectSettings-meta.xml
 *      │   ├─ PO_Manager.applicationVisibilities-meta.xml
 *      │   ├─ PO_Manager.classAccesses-meta.xml
 *```
 */
export class FilePerChildTypeSourceAdapter extends MixedContentSourceAdapter {
  protected ownFolder = true;
  protected metadataWithContent = false;

  public getComponent(path: SourcePath, isResolvingSource = true): SourceComponent | undefined {
    let rootMetadata = super.parseAsRootMetadataXml(path);

    if (!rootMetadata) {
      const rootMetadataPath = this.getRootMetadataXmlPath(path);
      if (rootMetadataPath) {
        rootMetadata = parseMetadataXml(rootMetadataPath);
      }
    }
    let component: SourceComponent | undefined;
    if (rootMetadata) {
      const componentName = this.type.folderType
        ? `${parentName(rootMetadata.path)}/${rootMetadata.fullName}`
        : rootMetadata.fullName;
      component = new SourceComponent(
        {
          name: componentName,
          type: this.type,
          xml: rootMetadata.path,
        },
        this.tree,
        this.forceIgnore
      );
    }
    return this.populate(path, component, isResolvingSource);
  }

  /**
   * If the trigger turns out to be part of an addressable child component, `populate` will build
   * the child component, set its parent property to the one created by the
   * `BaseSourceAdapter`, and return the child component instead.
   */
  protected populate(
    trigger: SourcePath,
    component?: SourceComponent,
    isResolvingSource?: boolean
  ): SourceComponent | undefined {
    const metaXml = parseMetadataXml(trigger);
    if (metaXml?.suffix) {
      const pathToContent = this.trimPathToContent(trigger);
      const childTypeId = this.type.children?.suffixes?.[metaXml.suffix];
      const triggerIsAChild = !!childTypeId;
      const strategy = this.type.strategies?.decomposition;
      if (
        triggerIsAChild &&
        this.type.children &&
        !this.type.children.types[childTypeId].unaddressableWithoutParent &&
        this.type.children.types[childTypeId].isAddressable !== false
      ) {
        if (strategy === 'folderPerType' || strategy === 'topLevel' || isResolvingSource) {
          const parent =
            component ??
            new SourceComponent(
              {
                name: strategy === 'folderPerType' ? baseName(pathToContent) : pathToContent,
                type: this.type,
              },
              this.tree,
              this.forceIgnore
            );
          parent.content = pathToContent;
          return new SourceComponent(
            {
              name: metaXml.fullName,
              type: this.type.children.types[childTypeId],
              xml: trigger,
              parent,
            },
            this.tree,
            this.forceIgnore
          );
        }
      } else if (!component) {
        // This is most likely metadata found within a CustomObject folder that is not a
        // child type of CustomObject. E.g., Layout, SharingRules, ApexClass.
        throw new SfError(
          messages.getMessage('error_unexpected_child_type', [trigger, this.type.name]),
          'TypeInferenceError'
        );
      }
      if (component) {
        component.content = pathToContent;
      }
    }
    return component;
  }
}
