# md_request_fail

Metadata API request failed: %s

# error_convert_invalid_format

Invalid conversion format '%s'

# error_could_not_infer_type

%s: Could not infer a metadata type

# error_unexpected_child_type

Unexpected child metadata [%s] found for parent type [%s]

# noParent

Could not find parent type for %s (%s)

# error_expected_source_files

%s: Expected source files for type '%s'

# error_failed_convert

Component conversion failed: %s

# error_merge_metadata_target_unsupported

Merge convert for metadata target format currently unsupported

# error_missing_adapter

Missing adapter '%s' for metadata type '%s'

# error_missing_transformer

Missing transformer '%s' for metadata type '%s'

# error_missing_type_definition

Missing metadata type definition in registry for id '%s'.

# error_missing_child_type_definition

Type %s does not have a child type definition %s.

# noChildTypes

No child types found in registry for %s (reading %s at %s)

# error_no_metadata_xml_ignore

Metadata xml file %s is forceignored but is required for %s.

# noSourceIgnore

%s metadata types require source files, but %s is forceignored.

# noSourceIgnore.actions

- Metadata types with content are composed of two files: a content file (ie MyApexClass.cls) and a -meta.xml file (i.e MyApexClass.cls-meta.xml). You must include both files in your .forceignore file. Or try appending “\*” to your existing .forceignore entry.

See <https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_exclude_source.htm> for examples

# error_path_not_found

%s: File or folder not found

# noContentFound

SourceComponent %s (metadata type = %s) is missing its content file.

# noContentFound.actions

- Ensure the content file exists in the expected location.
- If the content file is in your .forceignore file, ensure the meta-xml file is also ignored to completely exclude it.

# error_parsing_xml

SourceComponent %s (metadata type = %s) does not have an associated metadata xml to parse

# error_expected_file_path

%s: path is to a directory, expected a file

# error_expected_directory_path

%s: path is to a file, expected a directory

# error_directory_not_found_or_not_directory

%s: path is not a directory

# error_no_directory_stream

%s doesn't support readable streams on directories.

# error_no_source_to_deploy

No source-backed components present in the package.

# error_no_components_to_retrieve

No components in the package to retrieve.

# error_static_resource_expected_archive_type

A StaticResource directory must have a content type of application/zip or application/jar - found %s for %s.

# error_static_resource_missing_resource_file

A StaticResource must have an associated .resource file, missing %s.resource-meta.xml

# error_no_job_id

The %s operation is missing a job ID. Initialize an operation with an ID, or start a new job.

# missingApiVersion

Could not determine an API version to use for the generated manifest. Tried looking for sourceApiVersion in sfdx-project.json, apiVersion from config vars, and the highest apiVersion from the APEX REST endpoint. Using API version 58.0 as a last resort.

# invalid_xml_parsing

error parsing %s due to:\n message: %s\n line: %s\n code: %s

# zipBufferError

Zip buffer was not created during conversion

# undefinedComponentSet

Unable to construct a componentSet. Check the logs for more information.

# replacementsFileNotRead

The file "%s" specified in the "replacements" property of sfdx-project.json could not be read.

# unsupportedBundleType

Unsupported Bundle Type: %s

# filePathGeneratorNoTypeSupport

Type not supported for filepath generation: %s

# missingFolderType

The registry has %s as is inFolder but it does not have a folderType

# tooManyFiles

Multiple files found for path: %s.

# cantGetName

Unable to calculate fullName from path: %s (%s)

# missingMetaFileSuffix

The metadata registry is configured incorrectly for %s. Expected a metaFileSuffix.

# uniqueIdElementNotInRegistry

No uniqueIdElement found in registry for %s (reading %s at %s).

# uniqueIdElementNotInChild

The uniqueIdElement %s was not found the child (reading %s at %s).

# suggest_type_header

A metadata type lookup for "%s" found the following close matches:

# suggest_type_did_you_mean

-- Did you mean ".%s%s" instead for the "%s" metadata type?

# suggest_type_more_suggestions

Additional suggestions:
Confirm the file name, extension, and directory names are correct. Validate against the registry at:
<https://github.com/forcedotcom/source-deploy-retrieve/blob/main/src/registry/metadataRegistry.json>

If the type is not listed in the registry, check that it has Metadata API support via the Metadata Coverage Report:
<https://developer.salesforce.com/docs/metadata-coverage>

If the type is available via Metadata API but not in the registry

- Open an issue <https://github.com/forcedotcom/cli/issues>
- Add the type via PR. Instructions: <https://github.com/forcedotcom/source-deploy-retrieve/blob/main/contributing/metadata.md>

# type_name_suggestions

Confirm the metadata type name is correct. Validate against the registry at:
<https://github.com/forcedotcom/source-deploy-retrieve/blob/main/src/registry/metadataRegistry.json>

If the type is not listed in the registry, check that it has Metadata API support via the Metadata Coverage Report:
<https://developer.salesforce.com/docs/metadata-coverage>

If the type is available via Metadata API but not in the registry

- Open an issue <https://github.com/forcedotcom/cli/issues>
- Add the type via PR. Instructions: <https://github.com/forcedotcom/source-deploy-retrieve/blob/main/contributing/metadata.md>
