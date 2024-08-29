/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Messages, SfError } from '@salesforce/core';

import { SourcePath } from '../../common/types';
import { META_XML_SUFFIX } from '../../common/constants';
import { extName } from '../../utils/path';
import { SourceComponent } from '../sourceComponent';
import { BaseSourceAdapter } from './baseSourceAdapter';

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
export class FilePerChildTypeSourceAdapter extends BaseSourceAdapter {
  // disabled since used by subclasses
  // eslint-disable-next-line class-methods-use-this
  protected getRootMetadataXmlPath(trigger: SourcePath): SourcePath {
    return trigger;
  }

  protected populate(trigger: SourcePath, component: SourceComponent): SourceComponent {
    let sourcePath: SourcePath | undefined;

    if (component.xml === trigger) {
      const fsPath = removeMetaXmlSuffix(trigger);
      if (this.tree.exists(fsPath)) {
        sourcePath = fsPath;
      }
    } else if (this.registry.getTypeBySuffix(extName(trigger)) === this.type) {
      sourcePath = trigger;
    }

    if (!sourcePath) {
      throw new SfError(
        messages.getMessage('error_expected_source_files', [trigger, this.type.name]),
        'ExpectedSourceFilesError'
      );
    } else if (this.forceIgnore.denies(sourcePath)) {
      throw messages.createError('noSourceIgnore', [this.type.name, sourcePath]);
    }

    component.content = sourcePath;
    return component;
  }
}

const removeMetaXmlSuffix = (fsPath: SourcePath): SourcePath => fsPath.slice(0, fsPath.lastIndexOf(META_XML_SUFFIX));
