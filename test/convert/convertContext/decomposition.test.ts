/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
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
