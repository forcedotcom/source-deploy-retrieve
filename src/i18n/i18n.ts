/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * Conventions:
 * _message: is for unformatted text that will be shown as-is to
 * the user.
 * _text: is for text that will appear in the UI, possibly with
 * decorations, e.g., $(x) uses the https://octicons.github.com/ and should not
 * be localized
 *
 * If ommitted, we will assume _message.
 */
export const messages = {
  md_request_fail: 'Metadata API request failed',
  md_request_timeout: 'Metadata API request timed out',
  error_directories_not_supported:
    'Paths to directories are currently not supported',
  error_expected_source_files: "%s: Expected source files for '%s'",
  error_missing_adapter: "Missing adapter '%s' for metadata type '%s'",
  error_missing_metadata_xml: "%s: Metadata xml file missing for '%s'",
  error_missing_type_definition:
    "Missing metadata type definition in registry for id '%s'",
  error_could_not_infer_type: '%s: A type could not be inferred',
  error_path_not_found: '%s: File or folder not found'
};
