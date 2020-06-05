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
  registry_error_missing_type_definition: 'Missing metadata type definition for %s',
  registry_error_file_not_found: 'File not found %s',
  registry_error_missing_metadata_xml: 'Metadata xml file missing for %s',
  registry_error_unsupported_type: 'Types missing a defined suffix are currently unsupported',
  beta_tapi_mdcontainer_error: 'Unexpected error creating metadata container',
  beta_tapi_membertype_error: 'Unexpected error creating %s member',
  beta_tapi_car_error: 'Unexpected error creating container async request',
  beta_tapi_queue_status: 'The deploy is still in the queue',
  beta_tapi_membertype_unsupported_error: "'%s' type not supported",
  error_convert_invalid_format: "Invalid conversion format '%s'",
  error_convert_not_implemented: '%s format conversion not yet implemented for type %s',
  error_could_not_infer_type: '%s: Could not infer a metadata type',
  error_expected_source_files: "%s: Expected source files for type '%s'",
  error_failed_convert: 'Component conversion failed: %s',
  error_in_tooling_retrieve: 'Unexpected error while retrieving using Tooling API. Stack trace: %s',
  error_md_not_present_in_org: '%s was not found in org',
  error_missing_adapter: "Missing adapter '%s' for metadata type '%s'",
  error_missing_metadata_xml: "%s: Metadata xml file missing for '%s'",
  error_missing_type_definition: "Missing metadata type definition in registry for id '%s'",
  error_no_metadata_xml_ignore: 'Metadata xml file %s is forceignored but is required for %s',
  error_no_source_ignore: '%s types require source to be present and %s is forceignored.',
  error_path_not_found: '%s: File or folder not found',
  tapi_retrieve_component_limit_error:
    'This retrieve method only supports retrieving one metadata component at a time',
  error_on_manifest_creation: "Unexpected error while creating manifest for '%s'. Stack trace: %s",
  error_creating_metadata_type: "Unexpected error creating '%s'",
  error_updating_metadata_type: "Unexpected error updating '%s'",
  error_parsing_metadata_file: 'Error parsing metadata file',
  tapi_deploy_component_limit_error:
    'This deploy method only supports deploying one metadata component at a time'
};
