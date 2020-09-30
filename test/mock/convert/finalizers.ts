/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { WriterFormat } from '../../../src/convert';
import { ConvertTransactionFinalizer } from '../../../src/convert/convertTransaction';
import { keanu, simon } from '../registry';

export class TestFinalizerNoWrites implements ConvertTransactionFinalizer {
  public async finalize(): Promise<WriterFormat | WriterFormat[]> {
    return {
      component: keanu.KEANU_COMPONENT,
      writeInfos: [],
    };
  }
}

export class TestFinalizerNoResult implements ConvertTransactionFinalizer {
  public async finalize(): Promise<WriterFormat | WriterFormat[]> {
    return;
  }
}

export class TestFinalizerMultipleFormatsNoWrites implements ConvertTransactionFinalizer {
  public async finalize(): Promise<WriterFormat[]> {
    return [
      {
        component: keanu.KEANU_COMPONENT,
        writeInfos: [],
      },
      {
        component: simon.SIMON_COMPONENT,
        writeInfos: [],
      },
    ];
  }
}
