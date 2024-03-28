/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { WriterFormat } from '../types';

export abstract class ConvertTransactionFinalizer<T> {
  protected abstract transactionState: T;

  public abstract finalize(defaultDirectory?: string): Promise<WriterFormat[]>;
}
