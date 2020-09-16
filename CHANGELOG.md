# 1.1.3 - September 16, 2020

## Added

- Support conversions for CustomObjects to metadata format ([PR #136](https://github.com/forcedotcom/source-deploy-retrieve/pull/136))

- Support conversions for child components at the same level as the parent component ([PR #142](https://github.com/forcedotcom/source-deploy-retrieve/pull/142))

## Fixed

- Fix duplicate SourceComponents when scanning StaticResources with a directory for content ([PR #138](https://github.com/forcedotcom/source-deploy-retrieve/pull/138))

# 1.1.2 - September 10, 2020

## Added

- Support conversions for StaticResources to metadata format ([PR #127](https://github.com/forcedotcom/source-deploy-retrieve/pull/127))

- Adds metadata source format conversion for the default transformer ([PR #135](https://github.com/forcedotcom/source-deploy-retrieve/pull/135))

# 1.1.1 - September 3, 2020

## Added

- Support ObjectTranslations in metadata format ([PR #122](https://github.com/forcedotcom/source-deploy-retrieve/pull/122))

## Fixed

- Support CustomSite and SiteDotCom components ([PR #121](https://github.com/forcedotcom/source-deploy-retrieve/pull/121))

- Fix CustomObject conversions when parent xml is not present ([PR #124](https://github.com/forcedotcom/source-deploy-retrieve/pull/124))

- Update registry to API version 49.0 ([PR #123](https://github.com/forcedotcom/source-deploy-retrieve/pull/123))

# 1.0.21 - August 27, 2020

## Added

- Add registry support for WaveTemplateBundles and CustomObject child components when parent doesn't have a metadata xml ([PR #115](https://github.com/forcedotcom/source-deploy-retrieve/pull/115))

# 1.0.20 - August 20, 2020

## Fixed

- Add resolution for folder components in metadata format ([PR #109](https://github.com/forcedotcom/source-deploy-retrieve/pull/109))

# 1.0.19 - August 13, 2020

## Added

- Add component resolution for files in metadata format ([PR #94](https://github.com/forcedotcom/source-deploy-retrieve/pull/94))

- Add recomposition for CustomObjects ([PR #95](https://github.com/forcedotcom/source-deploy-retrieve/pull/95))

## Fixed

- Fixed content file not being included during source conversion for NetworkBranding components ([PR #106](https://github.com/forcedotcom/source-deploy-retrieve/pull/106))

# 1.0.18 - August 6, 2020

## Added

- Add readFile to TreeContainer ([PR #96](https://github.com/forcedotcom/source-deploy-retrieve/pull/96))

## Fixed

- Replaced module `gitignore-parser` for parsing forceignore files with `ignore` ([PR #98](https://github.com/forcedotcom/source-deploy-retrieve/pull/98))

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
