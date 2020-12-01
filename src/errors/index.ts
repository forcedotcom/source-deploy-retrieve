/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { nls } from '../i18n';
import { MetadataType, SourcePath } from '../common';

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
  constructor(
    type: MetadataType,
    originalPath: SourcePath,
    messageKey = 'error_expected_source_files'
  ) {
    super(messageKey, [originalPath, type.name]);
  }
}

export class UnexpectedForceIgnore extends RegistryError {
  constructor(messageKey: string, args?: string | string[]) {
    super(messageKey, args);
  }
}

export class SourceClientError extends LibraryError {
  constructor(messageKey: string, args?: string | string[]) {
    super(messageKey, args);
  }
}

export class DeployError extends SourceClientError {
  constructor(messageKey: string, args?: string | string[]) {
    super(messageKey, args);
  }
}

export class RetrieveError extends SourceClientError {
  constructor(messageKey: string, args?: string | string[]) {
    super(messageKey, args);
  }
}

/**
 * A wrapper for any errors thrown in the conversion pipeline
 */
export class ConversionError extends LibraryError {
  constructor(originalError: Error) {
    super('error_failed_convert', originalError.message);
    this.stack = originalError.stack;
  }
}

export class ComponentSetError extends LibraryError {
  constructor(messageKey: string, args?: string | string[]) {
    super(messageKey, args);
  }
}
