/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Messages, SfError } from '@salesforce/core';

import { SourcePath, META_XML_SUFFIX } from '../../common';
import { extName } from '../../utils/path';
import { SourceComponent } from '../sourceComponent';
import { BaseSourceAdapter } from './baseSourceAdapter';

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
export class MatchingContentSourceAdapter extends BaseSourceAdapter {
  // disabled since used by subclasses
  // eslint-disable-next-line class-methods-use-this
  protected getRootMetadataXmlPath(trigger: SourcePath): SourcePath {
    return `${trigger}${META_XML_SUFFIX}`;
  }

  protected populate(trigger: SourcePath, component: SourceComponent): SourceComponent {
    let sourcePath: SourcePath | undefined;

    if (component.xml === trigger) {
      const fsPath = removeMetaXmlSuffix(trigger);
      if (this.tree.exists(fsPath)) {
        sourcePath = fsPath;
      }
    } else if (this.extensionMatchesType(trigger)) {
      sourcePath = trigger;
    }

    if (!sourcePath) {
      throw new SfError(
        messages.getMessage('error_expected_source_files', [trigger, this.type.name]),
        'ExpectedSourceFilesError'
      );
    } else if (this.forceIgnore.denies(sourcePath)) {
      throw new SfError(
        messages.getMessage('error_no_source_ignore', [this.type.name, sourcePath]),
        'UnexpectedForceIgnore'
      );
    }

    component.content = sourcePath;
    return component;
  }

  private extensionMatchesType(fsPath: SourcePath): boolean {
    return this.registry.getTypeBySuffix(extName(fsPath)) === this.type;
  }
}

const removeMetaXmlSuffix = (fsPath: SourcePath): SourcePath => fsPath.slice(0, fsPath.lastIndexOf(META_XML_SUFFIX));
