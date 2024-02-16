there's a bug with converter.convert when converting mdapi to source with a long output directory--it'll use the entire directory for customLabels names (see snapshots inside the customLabels test)

Other types seem to get a relative-to-proj path.

Probably doesn't affect the CLI since we normally run the converts from inside a project rather than providing a long proj path.

---

## QA

1. does it work with packaging
1. partial delete: deleting a member locally redeploys without that file
1. partial delete: "removing" a member remotely deletes it locally if present
1. conflicts get assigned to the correct place

---

## doc work

1. Contributing Metadata (how to test new types using variants before adding to the real registry)
1. Doc for each preset

---

## Features

registryValidation runs against presets (either standalone or all merged in)
