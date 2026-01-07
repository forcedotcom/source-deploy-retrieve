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
import { join } from 'node:path';
import { expect } from 'chai';
import { DefaultSourceAdapter } from '../../../src/resolve/adapters';
import { registry, SourceComponent } from '../../../src';
import { META_XML_SUFFIX } from '../../../src/common';

describe('DefaultSourceAdapter', () => {
  it('should return a SourceComponent when given a metadata xml file', () => {
    const type = registry.types.apexclass;
    const path = join('path', 'to', type.directoryName, `My_Test.${type.suffix}${META_XML_SUFFIX}`);
    const adapter = new DefaultSourceAdapter(type);
    expect(adapter.getComponent(path)).to.deep.equal(
      new SourceComponent({
        name: 'My_Test',
        type,
        xml: path,
      })
    );
  });

  it('should return a SourceComponent when given a content-only metadata file', () => {
    const type = registry.types.apexclass;
    const path = join('path', 'to', type.directoryName, `My_Test.${type.suffix}`);
    const adapter = new DefaultSourceAdapter(type);
    expect(adapter.getComponent(path)).to.deep.equal(
      new SourceComponent({
        name: 'My_Test',
        type,
        xml: path,
      })
    );
  });
});
