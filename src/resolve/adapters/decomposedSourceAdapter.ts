/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { basename } from 'node:path';
import { Messages, SfError } from '@salesforce/core';
import { SourceComponent } from '../sourceComponent';
import { baseName, parentName, parseMetadataXml } from '../../utils/path';
import { parseAsRootMetadataXml, trimPathToContent } from './baseSourceAdapter';
import { AdapterContext } from './types';
import { GetComponentInput } from './types';
import { MaybeGetComponent } from './types';

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

export const getDecomposedComponent: MaybeGetComponent =
  (context) =>
  ({ type, path }) => {
    let rootMetadata = parseAsRootMetadataXml(type)(path);

    if (!rootMetadata) {
      const componentRoot = trimPathToContent(type)(path);
      const rootMetadataPath = context.tree.find('metadataXml', basename(componentRoot), componentRoot);
      if (rootMetadataPath) {
        rootMetadata = parseMetadataXml(rootMetadataPath);
      }
    }
    let component: SourceComponent | undefined;
    if (rootMetadata) {
      const componentName = type.folderType
        ? `${parentName(rootMetadata.path)}/${rootMetadata.fullName}`
        : rootMetadata.fullName;
      component = new SourceComponent(
        {
          name: componentName,
          type,
          xml: rootMetadata.path,
        },
        context.tree,
        context.forceIgnore
      );
    }
    return populate(context)({ type, path })(component);
  };

const populate =
  (context: AdapterContext) =>
  ({ type, path }: GetComponentInput) =>
  (component?: SourceComponent): SourceComponent | undefined => {
    const metaXml = parseMetadataXml(path);
    if (!metaXml?.suffix) return component;

    const pathToContent = trimPathToContent(type)(path);
    const childTypeId = type.children?.suffixes?.[metaXml.suffix];
    const triggerIsAChild = !!childTypeId;
    const strategy = type.strategies?.decomposition;
    if (
      triggerIsAChild &&
      type.children &&
      !type.children.types[childTypeId].unaddressableWithoutParent &&
      type.children.types[childTypeId].isAddressable !== false
    ) {
      if (strategy === 'folderPerType' || strategy === 'topLevel' || context.isResolvingSource) {
        const parent =
          component ??
          new SourceComponent(
            {
              name: strategy === 'folderPerType' ? baseName(pathToContent) : pathToContent,
              type,
            },
            context.tree,
            context.forceIgnore
          );
        parent.content = pathToContent;
        return new SourceComponent(
          {
            name: metaXml.fullName,
            type: type.children.types[childTypeId],
            xml: path,
            parent,
          },
          context.tree,
          context.forceIgnore
        );
      }
    } else if (!component) {
      // This is most likely metadata found within a CustomObject folder that is not a
      // child type of CustomObject. E.g., Layout, SharingRules, ApexClass.
      throw new SfError(messages.getMessage('error_unexpected_child_type', [path, type.name]), 'TypeInferenceError');
    }
    if (component) {
      component.content = pathToContent;
    }

    return component;
  };
