# webapp_empty_file

webapplication.json must not be empty (%s).

# webapp_empty_file.actions

Add at least one property, e.g. { "outputDir": "dist" }

# webapp_size_exceeded

webapplication.json exceeds the maximum allowed size of %s KB (actual: %s KB).

# webapp_size_exceeded.actions

Reduce the file size. The descriptor should only contain configuration, not static content.

# webapp_whitespace_only

webapplication.json must not be empty or contain only whitespace (%s).

# webapp_whitespace_only.actions

Replace the whitespace with valid JSON, e.g. { "outputDir": "dist" }

# webapp_invalid_json

webapplication.json is not valid JSON: %s

# webapp_invalid_json.actions

Fix the JSON syntax in webapplication.json. Use a JSON validator to find the exact issue.

# webapp_not_object

webapplication.json must be a JSON object, but found %s.

# webapp_not_object.actions

Wrap the content in curly braces, e.g. { "outputDir": "dist" }

# webapp_empty_object

webapplication.json must contain at least one property.

# webapp_empty_object.actions

Add a property: outputDir, routing, or headers.

# webapp_unknown_props

webapplication.json contains unknown %s: %s. Allowed: %s.

# webapp_type_mismatch

webapplication.json '%s' must be %s (received %s).

# webapp_empty_value

webapplication.json '%s' must not be empty.

# webapp_invalid_enum

webapplication.json '%s' must be one of: %s (received "%s").

# webapp_min_items

webapplication.json '%s' must contain at least one %s.

# webapp_unknown_prop

webapplication.json '%s' contains unknown property '%s'. Allowed: %s.

# webapp_non_empty_string

webapplication.json '%s' must be a non-empty string.

# webapp_path_unsafe

webapplication.json '%s' value "%s" contains %s. Config paths must use forward slashes.

# webapp_path_traversal

webapplication.json '%s' value "%s" resolves outside the application bundle. Path traversal is not allowed.

# webapp_outputdir_is_root

webapplication.json 'outputDir' value "%s" resolves to the bundle root. It must reference a subdirectory.

# webapp_outputdir_is_root.actions

Set outputDir to a subdirectory like "dist" or "build".

# webapp_dir_not_found

webapplication.json 'outputDir' references "%s", but the directory does not exist at %s.

# webapp_dir_empty

webapplication.json 'outputDir' ("%s") exists but contains no files. It must contain at least one deployable file.

# webapp_file_not_found

webapplication.json '%s' references "%s", but the file does not exist at %s.
