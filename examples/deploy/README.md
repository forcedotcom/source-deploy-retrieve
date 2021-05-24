# Deploying Components

This module provides code examples of how to deploy metadata components using `ComponentSet.deploy()`.

All deploy operations require "source-backed components", meaning component objects must have source files
associated in order to build a package. This is usually done through source component resolution, e.g. `ComponentSet.fromSource('/path/to/directory/or/metadata/file')`.

See the examples for other methods of constructing source components and deploying them.