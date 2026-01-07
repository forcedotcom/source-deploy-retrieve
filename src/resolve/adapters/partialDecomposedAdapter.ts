/*
 * Copyright 2026, Salesforce, Inc.
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
import { basename } from 'node:path';
import { SourceComponent } from '../sourceComponent';
import { extName } from '../../utils';
import { DefaultSourceAdapter } from './defaultSourceAdapter';

/**
 * Handles types with partially decomposed content. This means that there will be 2+ files,
 * one being the parent (-meta.xml) and more being the "children" - these children make up one XML tag of the parent
 *
 * __Example Types__:
 *
 * DecomposeExternalServiceRegistrationBeta Preset
 *
 * __Example Structures__:
 *
 *```text
 * externalServiceRegistration/
 * ├── myFoo.externalServiceRegistration-meta.xml
 * ├── myFoo.yaml
 * ├── myFoo.json
 *```
 */
export class PartialDecomposedAdapter extends DefaultSourceAdapter {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected populate(trigger: string, component?: SourceComponent): SourceComponent {
    const parentType = this.registry.getParentType(this.type.id);

    // no children of this type,
    // the parent has child types
    // and the trigger starts with one of the parent's child's suffixes
    // => we have a child path
    if (
      !this.type.children &&
      parentType?.children &&
      Object.keys(parentType.children.suffixes).find((suffix) => trigger.endsWith(`.${suffix}`))
    ) {
      // we have a child, return the parent for the transformer to rebundle together
      return new SourceComponent(
        {
          name: getName(trigger),
          type: parentType,

          // change the xml to point to the parent, the transformer will reassemble all parts to form valid MD format files
          xml: trigger.replace(extName(trigger), 'externalServiceRegistration-meta.xml'),
        },
        this.tree,
        this.forceIgnore
      );
    } else {
      // we were given a parent
      return new SourceComponent(
        {
          name: getName(trigger),
          type: this.type,
          xml: trigger,
        },
        this.tree,
        this.forceIgnore
      );
    }
  }
}

function getName(contentPath: string): string {
  return basename(contentPath).split('.').at(0)!;
}
