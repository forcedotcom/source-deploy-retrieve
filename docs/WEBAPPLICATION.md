# WebApplication

SDR supports the WebApplication metadata type for deploying and retrieving web app bundles to a Salesforce org.

## Bundle Structure

```
force-app/main/default/webapplications/
  MyApp/
    MyApp.webapplication-meta.xml   # Required
    webapplication.json             # Optional
    dist/                           # or outputDir value
      index.html
      app.js
      styles.css
```

- Meta XML filename must match folder name: `{AppName}.webapplication-meta.xml`
- Content lives inside the app folder; paths in config are relative to that folder
- `webapplication.json` is optional — deploy without it for file-based routing

## webapplication.json

Allowed top-level properties: `outputDir`, `routing`, `headers`. Unknown properties cause deploy failure.

### outputDir

Non-empty string. Subdirectory containing built files (e.g. `dist`, `build`). Must exist and contain at least one file.

```json
{ "outputDir": "dist" }
```

### routing

Object with optional: `rewrites`, `redirects`, `fallback`, `trailingSlash`, `fileBasedRouting`. At least one property required.

- **trailingSlash:** `"always"` | `"never"` | `"auto"`
- **fallback:** File path for SPA fallback (e.g. `index.html`)
- **rewrites:** `[{ "route": "/app", "rewrite": "index.html" }]`
- **redirects:** `[{ "route": "/old", "redirect": "/new", "statusCode": 301 }]`

```json
{
  "outputDir": "dist",
  "routing": {
    "fallback": "index.html",
    "trailingSlash": "never"
  }
}
```

### headers

Array of `{ "source": "/path", "headers": [{ "key": "X-Custom", "value": "..." }] }`.

## Path Rules

All path values must use forward slashes, be relative (no leading `/`), and avoid `..` or path traversal. No globs (`*`, `?`), backslashes, or percent-encoding.

## Deploy and Retrieve

```bash
sf project deploy start --source-dir force-app/main/default/webapplications/MyApp --target-org myorg
sf project retrieve start --metadata WebApplication:MyApp --target-org myorg --output-dir retrieved
```

## Destructive Changes

To delete a WebApplication from the org, use `--post-destructive-changes` with a manifest:

**destructiveChanges.xml:**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
  <types>
    <members>MyApp</members>
    <name>WebApplication</name>
  </types>
  <version>66.0</version>
</Package>
```

```bash
sf project deploy start --manifest package.xml --post-destructive-changes destructiveChanges.xml --target-org myorg
```

## Further Reading

- [WEBAPPLICATION_LLM_RULES.md](./WEBAPPLICATION_LLM_RULES.md) — Schema rules and validation details for AI-assisted development
- [webapplication-json-validation-spec.md](./webapplication-json-validation-spec.md) — Validation spec
