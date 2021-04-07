/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { BaseSourceAdapter } from './baseSourceAdapter';
import { ExpectedSourceFilesError, UnexpectedForceIgnore } from '../../errors';
import { SourcePath, META_XML_SUFFIX } from '../../common';
import { extName } from '../../utils/path';
import { SourceComponent } from '../sourceComponent';

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
  protected getRootMetadataXmlPath(trigger: SourcePath): SourcePath {
    return `${trigger}${META_XML_SUFFIX}`;
  }

  protected populate(trigger: SourcePath, component: SourceComponent): SourceComponent {
    let sourcePath: SourcePath;

    if (component.xml === trigger) {
      const fsPath = this.removeMetaXmlSuffix(trigger);
      if (this.tree.exists(fsPath)) {
        sourcePath = fsPath;
      }
    } else if (this.extensionMatchesType(trigger)) {
      sourcePath = trigger;
    }

    if (!sourcePath) {
      throw new ExpectedSourceFilesError(this.type, trigger);
    } else if (this.forceIgnore.denies(sourcePath)) {
      throw new UnexpectedForceIgnore('error_no_source_ignore', [this.type.name, sourcePath]);
    }

    component.content = sourcePath;
    return component;
  }

  private removeMetaXmlSuffix(fsPath: SourcePath): SourcePath {
    return fsPath.slice(0, fsPath.lastIndexOf(META_XML_SUFFIX));
  }

  private extensionMatchesType(fsPath: SourcePath): boolean {
    return this.registry.getTypeBySuffix(extName(fsPath)) === this.type;
  }
}
