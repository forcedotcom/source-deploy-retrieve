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
  registry_error_missing_type_definition:
    'Missing metadata type definition for %s',
  registry_error_file_not_found: 'File not found %s',
  registry_error_missing_metadata_xml: 'Metadata xml file missing for %s',
  registry_error_unsupported_type:
    'Types missing a defined suffix are currently unsupported'
};
