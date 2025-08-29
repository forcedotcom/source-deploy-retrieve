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
import { Messages } from '@salesforce/core/messages';
import { SfError } from '@salesforce/core/sfError';
import { SourcePath } from '../../common/types';
import { SourceComponent } from '../sourceComponent';
import { baseName, parentName, parseMetadataXml } from '../../utils/path';
import { MixedContentSourceAdapter } from './mixedContentSourceAdapter';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/source-deploy-retrieve', 'sdr');

/**
 * Handles decomposed types. A flavor of mixed content where a component can
 * have additional -meta.xml files that represent child components of the main
 * component.
 *
 * __Example Types__:
 *
 * CustomObject, CustomObjectTranslation
 *
 * __Example Structures__:
 *
 *```text
 * foos/
 * ├── MyFoo__c/
 * |   ├── MyFoo__c.foo-meta.xml
 * |   ├── bars/
 * |      ├── a.bar-meta.xml
 * |      ├── b.bar-meta.xml
 * |      ├── c.bar-meta.xml
 *
 * foos/
 * ├── MyFoo__c/
 * |   ├── a.bar-meta.xml
 * |   ├── MyFoo__c.foo-meta.xml
 * |   ├── b.bar-meta.xml
 * |   ├── c.bar-meta.xml
 *```
 */
export class DecomposedSourceAdapter extends MixedContentSourceAdapter {
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
