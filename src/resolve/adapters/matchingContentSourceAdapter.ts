/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Messages, SfError } from '@salesforce/core';

import { ensure } from '@salesforce/ts-types';
import { SourcePath } from '../../common/types';
import { META_XML_SUFFIX } from '../../common/constants';
import { extName, parseMetadataXml } from '../../utils/path';
import { getComponent, parseAsRootMetadataXml } from './baseSourceAdapter';
import { FindRootMetadata, GetComponent, Populate } from './types';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/source-deploy-retrieve', 'sdr');

/**
 * Handles types with a single content file with a matching file extension.
 *
 * __Example Types__:
 *
 * ApexClass, ApexTrigger, ApexComponent
 *
 * __Example Structure__:
 *
 * ```text
 * foos/
 * ├── foobar.ext
 * ├── foobar.ext-meta.xml
 *```
 */

/** foo.bar-meta.xml => foo.bar */
const removeMetaXmlSuffix = (fsPath: SourcePath): SourcePath => fsPath.slice(0, fsPath.lastIndexOf(META_XML_SUFFIX));

export const getMatchingContentComponent: GetComponent =
  (context) =>
  ({ type, path }) => {
    const sourceComponent = ensure(getComponent(context)({ type, path, metadataXml: findRootMetadata }));
    return populate(context)(type)(path, sourceComponent);
  };

const findRootMetadata: FindRootMetadata = (type, path) => {
  const pathAsRoot = parseAsRootMetadataXml({ type, path });
  if (pathAsRoot) {
    return pathAsRoot;
  }

  const rootMetadataPath = `${path}${META_XML_SUFFIX}`;

  return ensure(parseMetadataXml(rootMetadataPath));
};

/** adds the `content` property to the component */
const populate: Populate = (context) => (type) => (trigger, component) => {
  let sourcePath: SourcePath | undefined;

  if (component.xml === trigger) {
    const fsPath = removeMetaXmlSuffix(trigger);
    if (context.tree.exists(fsPath)) {
      sourcePath = fsPath;
    }
  } else if (context.registry.getTypeBySuffix(extName(trigger)) === type) {
    sourcePath = trigger;
  }

  if (!sourcePath) {
    throw new SfError(
      messages.getMessage('error_expected_source_files', [trigger, type.name]),
      'ExpectedSourceFilesError'
    );
  } else if (context.forceIgnore?.denies(sourcePath)) {
    throw messages.createError('noSourceIgnore', [type.name, sourcePath]);
  }

  component.content = sourcePath;
  return component;
};
