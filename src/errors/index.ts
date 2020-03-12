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
    super('error_expected_source_files', [type.name, originalPath]);
    this.data = { type, originalPath };
  }
}
