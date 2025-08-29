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
import { META_XML_SUFFIX } from '../../common/constants';
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
