# md_request_fail

Metadata API request failed: %s

# md_request_timeout

Metadata API request timed out

# registry_error_missing_type_definition

Missing metadata type definition for %s

# registry_error_file_not_found

File not found %s

# registry_error_missing_metadata_xml

Metadata xml file missing for %s

# registry_error_unsupported_type

Types missing a defined suffix are currently unsupported

# beta_tapi_mdcontainer_error

Unexpected error creating metadata container

# beta_tapi_membertype_error

Unexpected error creating %s member

# beta_tapi_car_error

Unexpected error creating container async request

# beta_tapi_queue_status

The deploy is still in the queue

# beta_tapi_membertype_unsupported_error

'%s' type not supported

# error_convert_invalid_format

Invalid conversion format '%s'

# error_convert_not_implemented

%s format conversion not yet implemented for type %s

# error_could_not_infer_type

%s: Could not infer a metadata type

# error_unexpected_child_type

Unexpected child metadata [%s] found for parent type [%s]

# error_expected_source_files

%s: Expected source files for type '%s'

# error_failed_convert

Component conversion failed: %s

# error_merge_metadata_target_unsupported

Merge convert for metadata target format currently unsupported

# error_in_tooling_retrieve

Unexpected error while retrieving using Tooling API. Stack trace: %s

# error_md_not_present_in_org

%s was not found in org

# error_missing_adapter

Missing adapter '%s' for metadata type '%s'

# error_missing_transformer

Missing transformer '%s' for metadata type '%s'

# error_missing_metadata_xml

%s: Metadata xml file missing for '%s'

# error_unsupported_content_metadata_xml

%s: Unsupported content xml file for '%s'

# error_missing_type_definition

Missing metadata type definition in registry for id '%s'.

# error_missing_child_type_definition

Type %s does not have a child type definition %s.

# error_no_metadata_xml_ignore

Metadata xml file %s is forceignored but is required for %s.

# error_no_source_ignore

%s metadata types require source files, but %s is forceignored.

# error_no_source_ignore.actions

- Metadata types with content are composed of two files: a content file (ie MyApexClass.cls) and a -meta.xml file (i.e MyApexClass.cls-meta.xml). You must include both files in your .forceignore file. Or try appending “\*” to your existing .forceignore entry.

# error_path_not_found

%s: File or folder not found

# tapi_retrieve_component_limit_error

This retrieve method only supports retrieving one metadata component at a time

# error_on_manifest_creation

Unexpected error while creating manifest for '%s'. Stack trace: %s

# error_creating_metadata_type

Unexpected error creating '%s'

# error_updating_metadata_type

Unexpected error updating '%s'

# error_parsing_metadata_file

Error parsing metadata file

# error_parsing_xml

SourceComponent %s does not have an associated metadata xml to parse

# error_expected_file_path

%s: path is to a directory, expected a file

# error_expected_directory_path

%s: path is to a file, expected a directory

# error_no_directory_stream

%s doesn't support readable streams on directories.

# error_no_source_to_deploy

No source-backed components present in the package.

# error_no_components_to_retrieve

No components in the package to retrieve.

# error_invalid_package

The metadata package wasn't properly initialized.

# error_static_resource_expected_archive_type

A StaticResource directory must have a content type of application/zip or application/jar - found %s for %s.

# error_static_resource_missing_resource_file

A StaticResource must have an associated .resource file, missing %s.resource-meta.xml

# error_no_job_id

The %s operation is missing a job ID. Initialize an operation with an ID, or start a new job.

# tapi_deploy_component_limit_error

This deploy method only supports deploying one metadata component at a time

# warn_unresolved_source_for_components

The following components will not be deployed due to unresolved source: %s

# invalid_xml_parsing

error parsing %s due to:\n message: %s\n line: %s\n code: %s
