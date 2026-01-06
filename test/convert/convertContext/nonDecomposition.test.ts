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
import { createSandbox } from 'sinon';
import { SfProject } from '@salesforce/core';
import { expect } from 'chai';
import { nonDecomposed } from '../../mock';
import { ConvertContext } from '../../../src/convert/convertContext/convertContext';
import { JsToXml } from '../../../src/convert/streams';
import { XML_NS_KEY, XML_NS_URL, META_XML_SUFFIX } from '../../../src/common/constants';
import { VirtualTreeContainer } from '../../../src/resolve/treeContainers';
import {
  CHILD_2_XML,
  DEFAULT_DIR,
  NON_DEFAULT_DIR,
  TREE,
  VIRTUAL_DIR,
  WORKING_DIR,
} from '../../mock/type-constants/customlabelsConstant';
import { SourceComponent } from '../../../src';

describe('NonDecomposition', () => {
  const env = createSandbox();
  afterEach(() => env.restore());

  let sfProjectStub: sinon.SinonStub;
  beforeEach(() => {
    sfProjectStub = env.stub(SfProject, 'getInstance').returns({
      getPackageDirectories: () => [
        {
          name: 'force-app',
          path: 'force-app',
          fullPath: nonDecomposed.DEFAULT_DIR,
        },
      ],
    } as unknown as SfProject);
  });
  it('should return WriterFormats for claimed children', async () => {
    const component = nonDecomposed.COMPONENT_1;
    const context = new ConvertContext();
    const writeInfos = [
      {
        output: component.xml,
        source: new JsToXml(nonDecomposed.COMPONENT_1_XML),
      },
    ];
    context.nonDecomposition.transactionState = {
      childrenByUniqueElement: new Map([
        [nonDecomposed.CHILD_1_NAME, nonDecomposed.CHILD_1_XML],
        [nonDecomposed.CHILD_2_NAME, nonDecomposed.CHILD_2_XML],
      ]),
      exampleComponent: component,
    };

    const result = await context.nonDecomposition.finalize(nonDecomposed.DEFAULT_DIR, TREE);
    // @ts-ignore - because the resulting component will have cache info, and the initial one won't
    result[0].component.pathContentMap = new Map();
    expect(result).to.deep.equal([{ component, writeInfos }]);
  });

  it('should return WriterFormats when no local files exist', async () => {
    const component = new SourceComponent(nonDecomposed.COMPONENT_1);
    const context = new ConvertContext();
    const [baseName] = component.fullName.split('.');
    const output = join(
      nonDecomposed.DEFAULT_DIR,
      'main',
      'default',
      component.type.directoryName,
      `${baseName}.${component.type.suffix}${META_XML_SUFFIX}`
    );
    const writeInfos = [{ output, source: new JsToXml(nonDecomposed.COMPONENT_1_XML) }];
    context.nonDecomposition.transactionState = {
      childrenByUniqueElement: new Map([
        [nonDecomposed.CHILD_1_NAME, nonDecomposed.CHILD_1_XML],
        [nonDecomposed.CHILD_2_NAME, nonDecomposed.CHILD_2_XML],
      ]),
      exampleComponent: component,
    };

    const result = await context.nonDecomposition.finalize(
      nonDecomposed.DEFAULT_DIR,
      new VirtualTreeContainer(
        // leave the 2 pkgDirs empty
        VIRTUAL_DIR.filter((item) => [WORKING_DIR, DEFAULT_DIR, NON_DEFAULT_DIR].includes(item.dirPath)).map((item) =>
          [DEFAULT_DIR, NON_DEFAULT_DIR].includes(item.dirPath) ? { ...item, children: [] } : item
        )
      )
    );

    expect(result).to.deep.equal([{ component, writeInfos }]);
  });

  it('should merge unclaimed children to default parent component', async () => {
    const component = nonDecomposed.COMPONENT_1;
    const type = component.type;
    const context = new ConvertContext();

    const defaultPlusUnclaimed = {
      [type.name]: {
        [XML_NS_KEY]: XML_NS_URL,
        [type.directoryName]: [nonDecomposed.CHILD_1_XML, nonDecomposed.CHILD_2_XML, nonDecomposed.UNCLAIMED_CHILD_XML],
      },
    };
    const writeInfos = [{ output: component.xml, source: new JsToXml(defaultPlusUnclaimed) }];
    context.nonDecomposition.transactionState = {
      childrenByUniqueElement: new Map([
        [nonDecomposed.CHILD_1_NAME, nonDecomposed.CHILD_1_XML],
        [nonDecomposed.CHILD_2_NAME, nonDecomposed.CHILD_2_XML],
        [nonDecomposed.UNCLAIMED_CHILD_NAME, nonDecomposed.UNCLAIMED_CHILD_XML],
      ]),
      exampleComponent: component,
    };

    const result = await context.nonDecomposition.finalize(nonDecomposed.DEFAULT_DIR, TREE);
    // @ts-ignore - because the resulting component will have cache info, and the initial one won't
    result[0].component.pathContentMap = new Map();
    expect(result).to.deep.equal([{ component, writeInfos }]);
  });

  it('should merge 1 updated file', async () => {
    const component = new SourceComponent(nonDecomposed.COMPONENT_1, TREE);
    const context = new ConvertContext();
    const type = component.type;

    // change the word first to 'updated'
    const updatedChild1Xml = {
      ...nonDecomposed.CHILD_1_XML,
      value: nonDecomposed.CHILD_1_XML.value.replace('first', 'updated'),
    };

    const updatedFullXml = {
      [type.name]: {
        [XML_NS_KEY]: XML_NS_URL,
        [type.directoryName]: [updatedChild1Xml, CHILD_2_XML],
      },
    };

    const writeInfos = [{ output: component.xml, source: new JsToXml(updatedFullXml) }];
    context.nonDecomposition.transactionState = {
      childrenByUniqueElement: new Map([[nonDecomposed.CHILD_1_NAME, updatedChild1Xml]]),
      exampleComponent: component,
    };

    const result = await context.nonDecomposition.finalize(nonDecomposed.DEFAULT_DIR, TREE);
    // @ts-ignore - because the resulting component will have cache info, and the initial one won't
    result[0].component.pathContentMap = new Map();
    expect(result).to.deep.equal([{ component, writeInfos }]);
  });

  it('should merge 1 updated file to non-default dir and not write default file', async () => {
    sfProjectStub.restore();
    env.stub(SfProject, 'getInstance').returns({
      getPackageDirectories: () => [
        {
          name: 'my-app',
          path: 'my-app',
          fullPath: nonDecomposed.NON_DEFAULT_DIR,
        },
        {
          name: 'force-app',
          path: 'force-app',
          fullPath: nonDecomposed.DEFAULT_DIR,
        },
      ],
    } as unknown as SfProject);
    const component = nonDecomposed.COMPONENT_2;
    const context = new ConvertContext();
    const type = component.type;

    // change the word 'third' to 'updated'
    const updatedChild3Xml = {
      ...nonDecomposed.CHILD_3_XML,
      value: nonDecomposed.CHILD_3_XML.value.replace('third', 'updated'),
    };

    const updatedFullXml = {
      [type.name]: {
        [XML_NS_KEY]: XML_NS_URL,
        [type.directoryName]: [updatedChild3Xml],
      },
    };

    const writeInfos = [{ output: component.xml, source: new JsToXml(updatedFullXml) }];
    context.nonDecomposition.transactionState = {
      childrenByUniqueElement: new Map([[nonDecomposed.CHILD_3_NAME, updatedChild3Xml]]),
      exampleComponent: component,
    };

    const result = await context.nonDecomposition.finalize(nonDecomposed.DEFAULT_DIR, TREE);
    // @ts-ignore - because the resulting component will have cache info, and the initial one won't
    result[0].component.pathContentMap = new Map();
    expect(result).to.deep.equal([{ component, writeInfos }]);
  });
});
