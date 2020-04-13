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
    'Types missing a defined suffix are currently unsupported',
  beta_tapi_mdcontainer_error: 'Unexpected error creating metadata container',
  beta_tapi_membertype_error: 'Unexpected error creating %s member',
  beta_tapi_car_error: 'Unexpected error creating container async request',
  beta_tapi_queue_status: 'The deploy is still in the queue',
  beta_tapi_membertype_unsupported_error: '%s type not supported',
  error_directories_not_supported:
    'Paths to directories are currently not supported',
  error_expected_source_files: "%s: Expected source files for type '%s'",
  error_missing_adapter: "Missing adapter '%s' for metadata type '%s'",
  error_missing_metadata_xml: "%s: Metadata xml file missing for '%s'",
  error_missing_type_definition:
    "Missing metadata type definition in registry for id '%s'",
  error_could_not_infer_type: '%s: A type could not be inferred',
  error_path_not_found: '%s: File or folder not found',
  error_md_not_present_in_org: '%s was not found in org',
  error_in_tooling_retrieve:
    'Unexpected error while retrieving using Tooling API. Stack trace: %s',
  tapi_retrieve_component_limit_error:
    'This retrieve method only supports retrieving one metadata component at a time'
};
