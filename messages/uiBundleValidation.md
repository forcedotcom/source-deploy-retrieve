# ui_bundle_empty_file

ui-bundle.json must not be empty (%s).

# ui_bundle_empty_file.actions

Add at least one property, e.g. { "outputDir": "dist" }

# ui_bundle_size_exceeded

ui-bundle.json exceeds the maximum allowed size of %s KB (actual: %s KB).

# ui_bundle_size_exceeded.actions

Reduce the file size. The descriptor should only contain configuration, not static content.

# ui_bundle_whitespace_only

ui-bundle.json must not be empty or contain only whitespace (%s).

# ui_bundle_whitespace_only.actions

Replace the whitespace with valid JSON, e.g. { "outputDir": "dist" }

# ui_bundle_invalid_json

ui-bundle.json is not valid JSON: %s

# ui_bundle_invalid_json.actions

Fix the JSON syntax in ui-bundle.json. Use a JSON validator to find the exact issue.

# ui_bundle_not_object

ui-bundle.json must be a JSON object, but found %s.

# ui_bundle_not_object.actions

Wrap the content in curly braces, e.g. { "outputDir": "dist" }

# ui_bundle_empty_object

ui-bundle.json must contain at least one property.

# ui_bundle_empty_object.actions

Add a property: outputDir, routing, or headers.

# ui_bundle_unknown_props

ui-bundle.json contains unknown %s: %s. Allowed: %s.

# ui_bundle_mcp_resources_moved.actions

Move mcpResources to a mcp-resources.json file next to ui-bundle.json and prefix each path with the outputDir, e.g. { "mcpResources": [{ "name": "hello", "path": "dist/hello.html" }] }

# ui_bundle_type_mismatch

ui-bundle.json '%s' must be %s (received %s).

# ui_bundle_empty_value

ui-bundle.json '%s' must not be empty.

# ui_bundle_invalid_enum

ui-bundle.json '%s' must be one of: %s (received "%s").

# ui_bundle_min_items

ui-bundle.json '%s' must contain at least one %s.

# ui_bundle_unknown_prop

ui-bundle.json '%s' contains unknown property '%s'. Allowed: %s.

# ui_bundle_non_empty_string

ui-bundle.json '%s' must be a non-empty string.

# ui_bundle_path_unsafe

ui-bundle.json '%s' value "%s" contains %s. Config paths must use forward slashes.

# ui_bundle_path_traversal

ui-bundle.json '%s' value "%s" resolves outside the application bundle. Path traversal is not allowed.

# ui_bundle_outputdir_is_root

ui-bundle.json 'outputDir' value "%s" resolves to the bundle root. It must reference a subdirectory.

# ui_bundle_outputdir_is_root.actions

Set outputDir to a subdirectory like "dist" or "build".

# ui_bundle_dir_not_found

ui-bundle.json 'outputDir' references "%s", but the directory does not exist at %s.

# ui_bundle_dir_empty

ui-bundle.json 'outputDir' ("%s") exists but contains no files. It must contain at least one deployable file.

# ui_bundle_file_not_found

ui-bundle.json '%s' references "%s", but the file does not exist at %s.

# mcp_resources_empty_file

mcp-resources.json must not be empty or contain only whitespace (%s).

# mcp_resources_example.actions

Use { "mcpResources": [{ "name": "hello", "path": "dist/hello.html" }] }, or delete mcp-resources.json if the bundle has no MCP resources.

# mcp_resources_size_exceeded

mcp-resources.json exceeds the maximum allowed size of %s KB (actual: %s KB).

# mcp_resources_invalid_json

mcp-resources.json is not valid JSON: %s

# mcp_resources_not_object

mcp-resources.json must be a JSON object, but found %s.

# mcp_resources_unknown_props

mcp-resources.json contains unknown %s: %s. Allowed: %s.

# mcp_resources_missing

mcp-resources.json must contain 'mcpResources'.

# mcp_resources_type_mismatch

mcp-resources.json '%s' must be %s (received %s).

# mcp_resources_min_items

mcp-resources.json 'mcpResources' must contain at least one item.

# mcp_resources_unknown_prop

mcp-resources.json '%s' contains unknown property '%s'. Allowed: %s.

# mcp_resources_non_empty_string

mcp-resources.json '%s' must be a non-empty string.

# mcp_resources_duplicate_value

mcp-resources.json '%s' value "%s" is already used by %s.

# mcp_resources_value_too_long

mcp-resources.json '%s' must be at most %s characters (received %s).

# mcp_resources_name_invalid

mcp-resources.json '%s' value "%s" must start with a letter or digit, contain only letters, digits, '\_', '.', or '-', and be at most 80 characters.

# mcp_resources_not_html

mcp-resources.json '%s' value "%s" must reference an .html file.

# mcp_resources_path_unsafe

mcp-resources.json '%s' value "%s" contains %s. Config paths must use forward slashes.

# mcp_resources_path_traversal

mcp-resources.json '%s' value "%s" resolves outside the bundle directory. Path traversal is not allowed.

# mcp_resources_file_not_found

mcp-resources.json '%s' references "%s", but the file does not exist at %s.
