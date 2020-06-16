/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { META_XML_SUFFIX } from '../../utils';
import { existsSync } from 'fs';
import { BaseSourceAdapter } from './baseSourceAdapter';
import { ExpectedSourceFilesError, UnexpectedForceIgnore } from '../../errors';
import { SourcePath, MetadataComponent } from '../../types';
import { extName } from '../../utils/path';

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

  protected populate(component: MetadataComponent, trigger: SourcePath): MetadataComponent {
    let sourcePath: SourcePath;
    if (component.xml === trigger) {
      const path = trigger.slice(0, trigger.lastIndexOf(META_XML_SUFFIX));
      if (existsSync(path)) {
        sourcePath = path;
      }
    } else if (this.registry.suffixes[extName(trigger)]) {
      sourcePath = trigger;
    }
    if (!sourcePath) {
      throw new ExpectedSourceFilesError(this.type, trigger);
    } else if (this.forceIgnore.denies(sourcePath)) {
      throw new UnexpectedForceIgnore('error_no_source_ignore', [this.type.name, sourcePath]);
    }

    component.sources = [sourcePath];
    return component;
  }
}
