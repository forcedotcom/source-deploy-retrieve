/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SourcePath, MetadataType } from '../metadata-registry';
import { nls } from '../i18n';

export class LibraryError extends Error {
  constructor(messageKey: string, args?: string | string[]) {
    super(nls.localize(messageKey, args));
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class RegistryError extends LibraryError {
  constructor(messageKey: string, args?: string | string[]) {
    super(messageKey, args);
  }
}

export class TypeInferenceError extends RegistryError {
  constructor(messageKey: string, args?: string | string[]) {
    super(messageKey, args);
  }
}

export class ExpectedSourceFilesError extends RegistryError {
  public readonly data: any;
  constructor(type: MetadataType, originalPath: SourcePath) {
    super('error_expected_source_files', [originalPath, type.name]);
    this.data = { type, originalPath };
  }
}
