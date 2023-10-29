/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Readable } from 'node:stream';

export class TestReadable extends Readable {
  // @ts-ignore
  private fsPath: string;
  public constructor(fsPath: string) {
    super();
    this.fsPath = fsPath;
  }
}
