# 2.1.1 - April 20, 2021

## Fixed

- Updated registry to fix source conversion for the following types ([PR #307](https://github.com/forcedotcom/source-deploy-retrieve/pull/307)):
  - AccountRelationshipShareRule
  - TimeSheetTemplate
  - WaveDashboard
  - WaveLens
  - WaveDataflow
  - WaveRecipe

# 2.1.0 - April 14, 2021

## Added

- Support split CustomLabels on deploy and retrieve ([PR #278](https://github.com/forcedotcom/source-deploy-retrieve/pull/278))

- Add `fullName` property to `ComponentSet` to be included in package xml generation ([PR #296](https://github.com/forcedotcom/source-deploy-retrieve/pull/296))

## Fixed

- Fix requiring consumer to install types of `unzipper` internal dependency ([PR #305](https://github.com/forcedotcom/source-deploy-retrieve/pull/305))

# 2.0.0 - April 7, 2021

## Added

- Update from manifest initializer ([PR #279](https://github.com/forcedotcom/source-deploy-retrieve/pull/279))

- Add workskillrouting type to registry ([PR #287](https://github.com/forcedotcom/source-deploy-retrieve/pull/287))

- Generate api documentation ([PR #275](https://github.com/forcedotcom/source-deploy-retrieve/pull/275))

- Support SFDX_MDAPI_TEMP_DIR environment variable for metadata deploys and retrieves ([PR #266](https://github.com/forcedotcom/source-deploy-retrieve/pull/266))

## Fixed

- Add documentation for tree containers ([PR #289](https://github.com/forcedotcom/source-deploy-retrieve/pull/289))

# 1.1.21 - March 30, 2021

## Added

- Better options for from source component set initializer ([PR #276](https://github.com/forcedotcom/source-deploy-retrieve/pull/276))

## Fixed

- Set an overridden apiVersion on a created connection ([PR #274](https://github.com/forcedotcom/source-deploy-retrieve/pull/274))

- Merge deploy api options ([PR #272](https://github.com/forcedotcom/source-deploy-retrieve/pull/272))

- Add testLevel to MetadataApiDeployOptions type ([PR #271](https://github.com/forcedotcom/source-deploy-retrieve/pull/271))

# 1.1.20 - March 17, 2021

## Fixed

- Convert Document metadata type to document ([PR #263](https://github.com/forcedotcom/source-deploy-retrieve/pull/263))

# 1.1.19 - March 3, 2021

## Added

- Get file statuses from deploy results ([PR #249](https://github.com/forcedotcom/source-deploy-retrieve/pull/249))

- Retrieve using package names ([PR #251](https://github.com/forcedotcom/source-deploy-retrieve/pull/251))

## Fixed

- Fix some StaticResource zip files failing to convert to source format ([PR #260](https://github.com/forcedotcom/source-deploy-retrieve/pull/260))

# 1.1.18 - February 24, 2021

## Added

- Turn component sets into lazy collections ([PR #247](https://github.com/forcedotcom/source-deploy-retrieve/pull/247))

- Get file statuses from retrieve results ([PR #243](https://github.com/forcedotcom/source-deploy-retrieve/pull/243))

## Fixed

- Fix for recompostion failure when the parent xml did not exist ([PR #245](https://github.com/forcedotcom/source-deploy-retrieve/pull/245))

- Fix conversion failure to source format for StaticResource component with `octet-stream` content type  ([PR #244](https://github.com/forcedotcom/source-deploy-retrieve/pull/244))

- Fix timeout during metadata api deploy and retrieve operations ([PR #236](https://github.com/forcedotcom/source-deploy-retrieve/pull/236))

- Convert folder components to source format correctly ([PR #239](https://github.com/forcedotcom/source-deploy-retrieve/pull/239))

# 1.1.16 - February 9, 2021

## Added

- Support dividing a decomposed component across different directories ([PR #224](https://github.com/forcedotcom/source-deploy-retrieve/pull/224))

# 1.1.15 - January 12, 2021

## Added

- Support merging a component into multiple existing copies during conversion ([PR #223](https://github.com/forcedotcom/source-deploy-retrieve/pull/223))

## Fixed

- Fix issue setting up connection when deploying or retrieving ComponentSet ([PR #226](https://github.com/forcedotcom/source-deploy-retrieve/pull/226))

# 1.1.14 - December 7, 2020
## Fixed

- Fix issue with deploying individual child components ([#220](https://github.com/forcedotcom/source-deploy-retrieve/pull/220))

# 1.1.13 - December 3, 2020
## Fixed

- Add non-source components when initializing ComponentSets with resolve option ([#217](https://github.com/forcedotcom/source-deploy-retrieve/pull/217))

# 1.1.12 - December 2, 2020

## Fixed

- Handle Folder metadata types ([PR #208](https://github.com/forcedotcom/source-deploy-retrieve/pull/208))

- Report accurate retrieve operation status when using wildcards in manifest files ([PR #209](https://github.com/forcedotcom/source-deploy-retrieve/pull/209))

- Report correct retrieve file output ([PR #210](https://github.com/forcedotcom/source-deploy-retrieve/pull/210))

- Handle multiple resolve targets when parsing manifest files ([PR #211](https://github.com/forcedotcom/source-deploy-retrieve/pull/211))

- Enable multiple source-backed components for a single metadata component ([PR #212](https://github.com/forcedotcom/source-deploy-retrieve/pull/212))

# 1.1.11 - November 12, 2020

## Fixed

- Fix default ForceIgnore rule unintentionally ignoring DuplicateRule components ([PR #200](https://github.com/forcedotcom/source-deploy-retrieve/pull/200))

## Added

- Add "Working Set Collection" to perform library functionality on a set of components ([PR #201](https://github.com/forcedotcom/source-deploy-retrieve/pull/201))

- Handle wildcards when parsing manifest files ([PR #205](https://github.com/forcedotcom/source-deploy-retrieve/pull/205))

# 1.1.10 - November 6, 2020

## Fixed

- Export `ForceIgnore` class ([PR #198](https://github.com/forcedotcom/source-deploy-retrieve/pull/198))

- Export `RetrieveMessage` type ([PR #195](https://github.com/forcedotcom/source-deploy-retrieve/pull/195))

## Added

- Move `RegistryAccess` functionality to new  `MetadataResolver` class ([PR #194](https://github.com/forcedotcom/source-deploy-retrieve/pull/194), [PR #199](https://github.com/forcedotcom/source-deploy-retrieve/pull/199))

# 1.1.9 - October 28, 2020

## Fixed

- Support API version 50.0 ([PR #189](https://github.com/forcedotcom/source-deploy-retrieve/pull/189))

## Added

- Convert and merge static resources ([PR #186](https://github.com/forcedotcom/source-deploy-retrieve/pull/186))

# 1.1.8 - October 23, 2020

## Fixed

- Handle trailing slashes on forceignore rules ([PR #190](https://github.com/forcedotcom/source-deploy-retrieve/pull/190))

## Added

- Convert and merge decomposed component types ([PR #184](https://github.com/forcedotcom/source-deploy-retrieve/pull/184))

# 1.1.7 - October 15, 2020

## Fixed

- Fixed resolution of decomposed child components ([PR #174](https://github.com/forcedotcom/source-deploy-retrieve/pull/174))

# 1.1.6 - October 7, 2020

## Added

- Add more detail to metadata api retrieve result ([PR #155](https://github.com/forcedotcom/source-deploy-retrieve/pull/155))

- Performance improvements to extracting zip file from metadata retrieve ([PR #164](https://github.com/forcedotcom/source-deploy-retrieve/pull/164))

## Fixed

- Fix creating an empty parent xml when decomposing child components ([PR #166](https://github.com/forcedotcom/source-deploy-retrieve/pull/166))

# 1.1.5 - October 1, 2020

## Added

- Add ZipTreeContainer and stream() to TreeContainer interface ([PR #154](https://github.com/forcedotcom/source-deploy-retrieve/pull/154))

## Fixed

- Fix ZipTreeContainer adding duplicate entries ([PR #158](https://github.com/forcedotcom/source-deploy-retrieve/pull/158))

- Fix output package path during source conversion ([PR #153](https://github.com/forcedotcom/source-deploy-retrieve/pull/153))

# 1.1.4 - September 23, 2020

## Added

- Retrieve components using the Metadata API to a specified directory ([PR #143](https://github.com/forcedotcom/source-deploy-retrieve/pull/143))

- Convert StaticResources from metadata format to source format ([#141](https://github.com/forcedotcom/source-deploy-retrieve/pull/141))

- Show warning when user has a .forceignore file incompatible with the new parser ([#129](https://github.com/forcedotcom/source-deploy-retrieve/pull/129))

## Fixed

- Fix output directory not being created if it doesn't exist during conversion ([PR #148](https://github.com/forcedotcom/source-deploy-retrieve/pull/148)

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
