# 1.0.18 - August 6, 2020

## Added

- Add readFile to TreeContainer ([PR #96](https://github.com/forcedotcom/source-deploy-retrieve/pull/96))

## Fixed

- Replaced `gitignore-parser` library with `ignore` ([PR #98](https://github.com/forcedotcom/source-deploy-retrieve/pull/98))

# 1.0.17 - July 28, 2020

## Added

- Metadata and tooling clients return new `SourceDeployResult` type for deploys. ([PR #85](https://github.com/forcedotcom/source-deploy-retrieve/pull/85), [PR #87](https://github.com/forcedotcom/source-deploy-retrieve/pull/87), [PR #88](https://github.com/forcedotcom/source-deploy-retrieve/pull/88), [PR #89](https://github.com/forcedotcom/source-deploy-retrieve/pull/89))

# 1.0.16 - July 16, 2020

## Added

- Support configuration options on Metadata API deploys ([PR #78](https://github.com/forcedotcom/source-deploy-retrieve/pull/78), [PR #80](https://github.com/forcedotcom/source-deploy-retrieve/pull/80))

## Fixed

- Update output format for generated manifest ([PR #81](https://github.com/forcedotcom/source-deploy-retrieve/pull/81))

# 1.0.15 - July 2, 2020

## Added

- Metadata API deploy for types with no special transformation ([PR #70](https://github.com/forcedotcom/source-deploy-retrieve/pull/70))

# 1.0.14 - June 26, 2020

## Fixed

- Add namespace support for Tooling API deploy and retrieve operations ([PR #66](https://github.com/forcedotcom/source-deploy-retrieve/pull/66))

## Added

- Introduce TreeContainer interface on Metadata Registry ([PR #68](https://github.com/forcedotcom/source-deploy-retrieve/pull/68))

# 1.0.13 - June 18, 2020

## Fixed

- Corrected file creation for retrieve ([PR #56](https://github.com/forcedotcom/source-deploy-retrieve/pull/56))

- Fixed formatting and linting issues ([PR #59](https://github.com/forcedotcom/source-deploy-retrieve/pull/59))

# 1.0.12 - June 11, 2020

## Fixed

- Include component files in DeployResult.outboundFiles ([PR #54](https://github.com/forcedotcom/source-deploy-retrieve/pull/54))

## Added

- Support zip output for Source Conversion ([PR #48](https://github.com/forcedotcom/source-deploy-retrieve/pull/48))
- Add decomposed adapter to Metadata Registry ([PR #42](https://github.com/forcedotcom/source-deploy-retrieve/pull/42))
