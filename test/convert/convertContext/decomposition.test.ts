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

import { Readable } from 'node:stream';
import { expect } from 'chai';
import { decomposed } from '../../mock';
import { ConvertContext } from '../../../src/convert/convertContext/convertContext';

describe('Decomposition', () => {
  it('should return WriterFormats only for components where a merge was not found', async () => {
    const component = decomposed.DECOMPOSED_COMPONENT;
    const context = new ConvertContext();
    const children = component.getChildren();
    const writeInfos = [
      {
        output: 'test',
        source: new Readable(),
      },
      {
        output: 'test2',
        source: new Readable(),
      },
    ];
    context.decomposition.transactionState.set(children[0].fullName, {
      origin: component,
      foundMerge: true,
      writeInfo: writeInfos[0],
    });

    context.decomposition.transactionState
      .set(children[0].fullName, {
        origin: component,
        foundMerge: true,
        writeInfo: writeInfos[0],
      })
      .set(children[1].fullName, {
        origin: component,
        writeInfo: writeInfos[1],
      });

    const result = await context.decomposition.finalize();

    expect(result).to.deep.equal([
      {
        component,
        writeInfos: [writeInfos[1]],
      },
    ]);
  });
});
