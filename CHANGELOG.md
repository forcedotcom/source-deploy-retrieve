# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [5.0.0-orb.1](https://github.com/forcedotcom/source-deploy-retrieve/compare/v5.0.0-orb.0...v5.0.0-orb.1) (2021-08-23)

## [5.0.0-orb.0](https://github.com/forcedotcom/source-deploy-retrieve/compare/v1.0.7...v5.0.0-orb.0) (2021-08-23)


### ⚠ BREAKING CHANGES

* metadata transfers are now done in 2 steps - start and pollStatus

* refactor: updates for review

make componentSet option optional. update jsdoc. regenerate yarn.lock with yarnkpkg registry.

* refactor(yarn.lock): start with existing yarn.lock

do not regenerate the yarn.lock from scratch; use existing.

### Features

* add support for making asynchronous metadata transfers ([#334](https://github.com/forcedotcom/source-deploy-retrieve/issues/334)) ([f26da78](https://github.com/forcedotcom/source-deploy-retrieve/commit/f26da78803d0f809d5dced21f6fe704befc61d16))
* add workskillrouting type to registry ([#287](https://github.com/forcedotcom/source-deploy-retrieve/issues/287)) ([433c367](https://github.com/forcedotcom/source-deploy-retrieve/commit/433c367a5ef73ba4189c8573309819105629a9e6))
* add zip tree container and stream() method to tree container interface ([#154](https://github.com/forcedotcom/source-deploy-retrieve/issues/154)) ([d179e47](https://github.com/forcedotcom/source-deploy-retrieve/commit/d179e47a0e3de845bd373c34ee60a96ffda5d2b7))
* added SDR Handbook to the repo ([#400](https://github.com/forcedotcom/source-deploy-retrieve/issues/400)) ([6d9d3c3](https://github.com/forcedotcom/source-deploy-retrieve/commit/6d9d3c368b9dacbc4e2b9ea57e4567e697edee34))
* adds option to convert source directly to the specified directory ([#332](https://github.com/forcedotcom/source-deploy-retrieve/issues/332)) ([98abed2](https://github.com/forcedotcom/source-deploy-retrieve/commit/98abed2d9ab353aa0b7fc78c84ce6bf38bb8fdb4))
* adds support for destructive changes ([#420](https://github.com/forcedotcom/source-deploy-retrieve/issues/420)) ([9d7ee33](https://github.com/forcedotcom/source-deploy-retrieve/commit/9d7ee33187cd1ac8c3ff345e691eddcd7cffbcdf))
* better options for from source component set initializer ([#276](https://github.com/forcedotcom/source-deploy-retrieve/issues/276)) ([dbe8a30](https://github.com/forcedotcom/source-deploy-retrieve/commit/dbe8a3039600308ac73aa706408fc9d72f086477))
* convert and merge components for default transformer types ([#176](https://github.com/forcedotcom/source-deploy-retrieve/issues/176)) ([ee6d7a6](https://github.com/forcedotcom/source-deploy-retrieve/commit/ee6d7a64d62e17311f2a852c2a35303cf0cc977e))
* convert and merge decomposed component types ([#184](https://github.com/forcedotcom/source-deploy-retrieve/issues/184)) ([7ca21a8](https://github.com/forcedotcom/source-deploy-retrieve/commit/7ca21a8e42b1e9826d7f4923abe068d62c52c22f))
* convert and merge static resources ([#186](https://github.com/forcedotcom/source-deploy-retrieve/issues/186)) ([334360a](https://github.com/forcedotcom/source-deploy-retrieve/commit/334360aaa27068479539c137d14fb48aad84ecc0))
* Convert source -> metadata format for StaticResources ([#127](https://github.com/forcedotcom/source-deploy-retrieve/issues/127)) ([a51e617](https://github.com/forcedotcom/source-deploy-retrieve/commit/a51e61739fbff0c3f6c5975d1586571944730136))
* **convert:** Support decomposing child components at same level as parent ([#142](https://github.com/forcedotcom/source-deploy-retrieve/issues/142)) ([7ec8368](https://github.com/forcedotcom/source-deploy-retrieve/commit/7ec8368e286a0941b20f93a588397dc8ddd7d066))
* Decompose CustomObjects (metadata format -> source format) ([#136](https://github.com/forcedotcom/source-deploy-retrieve/issues/136)) ([eb94a8e](https://github.com/forcedotcom/source-deploy-retrieve/commit/eb94a8e27eab9ba8597b3c4d913a7922c87e1c29))
* enable typedoc generation in circleci publish job ([#392](https://github.com/forcedotcom/source-deploy-retrieve/issues/392)) ([630a8bf](https://github.com/forcedotcom/source-deploy-retrieve/commit/630a8bf024b3857ae857de276e3be03d59c91bd4))
* enhance metadata retrieve result info  ([#155](https://github.com/forcedotcom/source-deploy-retrieve/issues/155)) ([49710d6](https://github.com/forcedotcom/source-deploy-retrieve/commit/49710d6e03f077320c44547969f426b87a81b6a5))
* generate api documentation ([#275](https://github.com/forcedotcom/source-deploy-retrieve/issues/275)) ([5d470de](https://github.com/forcedotcom/source-deploy-retrieve/commit/5d470de04e56fa4ea6840484f9439b0f1d749eb0))
* get file statuses from retrieve result ([#243](https://github.com/forcedotcom/source-deploy-retrieve/issues/243)) ([e79a1b8](https://github.com/forcedotcom/source-deploy-retrieve/commit/e79a1b81b04cb68ebd413dfa84e1865d0f95853c))
* handle wildcards in working set ([#205](https://github.com/forcedotcom/source-deploy-retrieve/issues/205)) ([12322da](https://github.com/forcedotcom/source-deploy-retrieve/commit/12322da32989248c03c933e13ebd09e2c05dfdbb))
* introduce working set paradigm, package xml parsing ([#201](https://github.com/forcedotcom/source-deploy-retrieve/issues/201)) ([1ba19ef](https://github.com/forcedotcom/source-deploy-retrieve/commit/1ba19ef5ed789074a9977d139ac19bacf09948ab))
* merge against multiple sources of the same component ([#223](https://github.com/forcedotcom/source-deploy-retrieve/issues/223)) ([b85ee30](https://github.com/forcedotcom/source-deploy-retrieve/commit/b85ee30f3ead3cdabf3c16ff3e055f69fa5c034e))
* metadata api deploy transfer result ([#249](https://github.com/forcedotcom/source-deploy-retrieve/issues/249)) ([e8c24fd](https://github.com/forcedotcom/source-deploy-retrieve/commit/e8c24fd699df1e1c4e7df1bb99a0abb96e861019))
* multiple resolve targets when parsing manifest ([#211](https://github.com/forcedotcom/source-deploy-retrieve/issues/211)) ([c02b827](https://github.com/forcedotcom/source-deploy-retrieve/commit/c02b827b94f873653e1aba78a66ba08f3346baa2))
* multiple source-backed components per member in ComponentSet ([#212](https://github.com/forcedotcom/source-deploy-retrieve/issues/212)) ([598beb1](https://github.com/forcedotcom/source-deploy-retrieve/commit/598beb117511ecc342648195d644df89298336da))
* new commitizen implementation ([#134](https://github.com/forcedotcom/source-deploy-retrieve/issues/134)) ([e018957](https://github.com/forcedotcom/source-deploy-retrieve/commit/e018957b3a71b6de7554bf9ffe8b63e6ccc582f3))
* support decomposed components across multiple directories ([#224](https://github.com/forcedotcom/source-deploy-retrieve/issues/224)) ([29dbdc7](https://github.com/forcedotcom/source-deploy-retrieve/commit/29dbdc728644d0ebf92ab75ff3b9d4e0e5ca7f0b))
* support split CustomLabels on deploy and retrieve ([#278](https://github.com/forcedotcom/source-deploy-retrieve/issues/278)) ([82826ff](https://github.com/forcedotcom/source-deploy-retrieve/commit/82826ff48d7af723894deba9fa32dc9bccedd1f6))
* turn component set into a lazy collection ([#247](https://github.com/forcedotcom/source-deploy-retrieve/issues/247)) ([797219f](https://github.com/forcedotcom/source-deploy-retrieve/commit/797219f191d666a7fa1b1285231cd70eb9021e08))
* update from manifest initializer ([#279](https://github.com/forcedotcom/source-deploy-retrieve/issues/279)) ([ba2b242](https://github.com/forcedotcom/source-deploy-retrieve/commit/ba2b24290bef847a4b0698fa875973adfd06937a))


### Bug Fixes

* add fullName to CompSet to be added to package.xml ([#296](https://github.com/forcedotcom/source-deploy-retrieve/issues/296)) ([04069e6](https://github.com/forcedotcom/source-deploy-retrieve/commit/04069e689310c0827082cc467c7221ee0477d38a))
* add rest option from core ([#352](https://github.com/forcedotcom/source-deploy-retrieve/issues/352)) ([9d072e8](https://github.com/forcedotcom/source-deploy-retrieve/commit/9d072e8ee798956fdc56c9060462aaff113d8d53))
* add retrieve via packageNames param ([#251](https://github.com/forcedotcom/source-deploy-retrieve/issues/251)) ([1b9c23f](https://github.com/forcedotcom/source-deploy-retrieve/commit/1b9c23f250bfb71b845e735babf9ad4b56dec6c7))
* add RunTestResult type ([#395](https://github.com/forcedotcom/source-deploy-retrieve/issues/395)) ([#398](https://github.com/forcedotcom/source-deploy-retrieve/issues/398)) ([498de53](https://github.com/forcedotcom/source-deploy-retrieve/commit/498de53447e10382b626649066c2df91cce1f33a))
* add SFDX_MDAPI_TEMP_DIR and test ([#266](https://github.com/forcedotcom/source-deploy-retrieve/issues/266)) ([72ca12d](https://github.com/forcedotcom/source-deploy-retrieve/commit/72ca12dbe6c48810fd55fe0d012b81d1cc4c4f9b))
* add support for sourceApiVersion ([#381](https://github.com/forcedotcom/source-deploy-retrieve/issues/381)) ([eebecfb](https://github.com/forcedotcom/source-deploy-retrieve/commit/eebecfb7abebd96883293b1a787c7ef4724401f7))
* add to component set even if unresolved source ([#217](https://github.com/forcedotcom/source-deploy-retrieve/issues/217)) ([7392c54](https://github.com/forcedotcom/source-deploy-retrieve/commit/7392c547e8318e2346e5c30a06847444e0fc879b))
* add WaveComponent to metadata registry ([#366](https://github.com/forcedotcom/source-deploy-retrieve/issues/366)) ([671ae1c](https://github.com/forcedotcom/source-deploy-retrieve/commit/671ae1c78954d2e56df877ee0056f474fa81474c))
* address deploy/retrieve timeout with metadata transfer paradigm ([#236](https://github.com/forcedotcom/source-deploy-retrieve/issues/236)) ([2e0b3da](https://github.com/forcedotcom/source-deploy-retrieve/commit/2e0b3da5ee77b3a436f40122a9966dd730c5c6ef))
* build issue with outdated reference ([#241](https://github.com/forcedotcom/source-deploy-retrieve/issues/241)) ([7b87862](https://github.com/forcedotcom/source-deploy-retrieve/commit/7b87862797bd5842a574a77f5bde6813420c9dc7))
* bump the version of @salesforce/core for PollingClient fix ([#361](https://github.com/forcedotcom/source-deploy-retrieve/issues/361)) ([d046b9d](https://github.com/forcedotcom/source-deploy-retrieve/commit/d046b9d7ab2aef1457a00a47ae1681505d259032))
* bump version of archiver for NodeJS v16 ([#399](https://github.com/forcedotcom/source-deploy-retrieve/issues/399)) ([ccaaa23](https://github.com/forcedotcom/source-deploy-retrieve/commit/ccaaa23e41622530a73f594d403b2467feb56138))
* bumps the version of core to 2.25.1 ([#369](https://github.com/forcedotcom/source-deploy-retrieve/issues/369)) ([b5350cd](https://github.com/forcedotcom/source-deploy-retrieve/commit/b5350cd7debf3d73c26e618ffb301d97c1b2c1c2))
* check for only children tags during decompose ([#166](https://github.com/forcedotcom/source-deploy-retrieve/issues/166)) ([3acc08c](https://github.com/forcedotcom/source-deploy-retrieve/commit/3acc08cf63f49277431d8982f9413a174e5d8179))
* child components not being deployed ([#220](https://github.com/forcedotcom/source-deploy-retrieve/issues/220)) ([86581e4](https://github.com/forcedotcom/source-deploy-retrieve/commit/86581e4c9230a4306b13f26c1c3183802633181c))
* codeowners file and package version ([388cb63](https://github.com/forcedotcom/source-deploy-retrieve/commit/388cb63e545d63da9b44a18a2d602d4b6cb5f2d4))
* convert Document metadata type to document ([#263](https://github.com/forcedotcom/source-deploy-retrieve/issues/263)) ([d364dd8](https://github.com/forcedotcom/source-deploy-retrieve/commit/d364dd834a7f0192fd6ce9f19236082298f96b17))
* convert folder components to source format correctly ([#239](https://github.com/forcedotcom/source-deploy-retrieve/issues/239)) ([5822a06](https://github.com/forcedotcom/source-deploy-retrieve/commit/5822a0680f597ff1a2c72df1a13381c1a13ca1a0))
* correct status when retrieving with wildcard ([#209](https://github.com/forcedotcom/source-deploy-retrieve/issues/209)) ([59c65dd](https://github.com/forcedotcom/source-deploy-retrieve/commit/59c65ddece811085d542b2eaf3edd0c578b926a8))
* correctly identify CustomSite and SiteDotCom components ([f491202](https://github.com/forcedotcom/source-deploy-retrieve/commit/f4912022525b10687c85dcc6e8722151fccc81e8))
* create dirs for zip conversion ([#148](https://github.com/forcedotcom/source-deploy-retrieve/issues/148)) @@W-8091341@ ([5a9e521](https://github.com/forcedotcom/source-deploy-retrieve/commit/5a9e521a01367c87b39efc71ca59ea0a7eca4d33))
* CustomObjects without a parent xml fail during conversion ([#124](https://github.com/forcedotcom/source-deploy-retrieve/issues/124)) ([7217807](https://github.com/forcedotcom/source-deploy-retrieve/commit/7217807d87012500ec3cae873ed882a67c7f85bf))
* duplicate SourceComponents when scanning StaticResources with a directory for content ([#138](https://github.com/forcedotcom/source-deploy-retrieve/issues/138)) ([38c4920](https://github.com/forcedotcom/source-deploy-retrieve/commit/38c4920c271e9c0999c5ba0a37d4c74d53bee8b3))
* export all public TS types and interfaces ([#423](https://github.com/forcedotcom/source-deploy-retrieve/issues/423)) ([1797cb7](https://github.com/forcedotcom/source-deploy-retrieve/commit/1797cb7a36c0f3accc150e04739cb40204db79ac))
* export FileProperties from the top level ([#335](https://github.com/forcedotcom/source-deploy-retrieve/issues/335)) ([638bef5](https://github.com/forcedotcom/source-deploy-retrieve/commit/638bef573f7e6afa8efedd0ea7c9fe1b5d8bf7f7))
* export MetadataApiDeployStatus from the top level ([#358](https://github.com/forcedotcom/source-deploy-retrieve/issues/358)) ([0a4bbbe](https://github.com/forcedotcom/source-deploy-retrieve/commit/0a4bbbecfb24e116c22ca43c08940d99476d6e90))
* fix cannot split issue ([#333](https://github.com/forcedotcom/source-deploy-retrieve/issues/333)) ([f8ab2d5](https://github.com/forcedotcom/source-deploy-retrieve/commit/f8ab2d5f4a68759cbf3da56ef2d877f46a399aed))
* fixed bug in old parser when using the defaults ([#200](https://github.com/forcedotcom/source-deploy-retrieve/issues/200)) ([3ccbfa8](https://github.com/forcedotcom/source-deploy-retrieve/commit/3ccbfa8c3dea147f5ba9e9e5d661c52d48664dad))
* follow commitizen format on CircleCI automation ([#216](https://github.com/forcedotcom/source-deploy-retrieve/issues/216)) ([a5b44eb](https://github.com/forcedotcom/source-deploy-retrieve/commit/a5b44eb09eb702782d83cd97c7dc8659d8f6ff65))
* force fullName to CustomLabels ([#427](https://github.com/forcedotcom/source-deploy-retrieve/issues/427)) ([832955f](https://github.com/forcedotcom/source-deploy-retrieve/commit/832955f8822c587d5bb595b5b56b5883cda7be25))
* forceIgnore does not work for `SFDX: Retrieve Source in Manifest from Org` in vscode extension ([#413](https://github.com/forcedotcom/source-deploy-retrieve/issues/413)) ([af52e37](https://github.com/forcedotcom/source-deploy-retrieve/commit/af52e37b37b616b7e563798e1440bcf9e544c88d))
* forceignore not respecting trailing / on windows ([#190](https://github.com/forcedotcom/source-deploy-retrieve/issues/190)) ([15a560f](https://github.com/forcedotcom/source-deploy-retrieve/commit/15a560fa9d210e061e4a32f6f3b5dac368649a4e))
* getComponent won't throw when parent is ignored ([#418](https://github.com/forcedotcom/source-deploy-retrieve/issues/418)) ([125ce16](https://github.com/forcedotcom/source-deploy-retrieve/commit/125ce16c808db0bc5c20c4f929ce9597e0593173))
* handling folders during various operations ([#208](https://github.com/forcedotcom/source-deploy-retrieve/issues/208)) ([e09a007](https://github.com/forcedotcom/source-deploy-retrieve/commit/e09a0078a6a3c735fa3bd1549c4ecb385b5a8dd1))
* ignore duplicate components in server response ([#401](https://github.com/forcedotcom/source-deploy-retrieve/issues/401)) ([a60cac5](https://github.com/forcedotcom/source-deploy-retrieve/commit/a60cac5ec0166c4970b66ebab94e16e16e3a7150))
* improve messaging for force ignore old vs new parsers ([#324](https://github.com/forcedotcom/source-deploy-retrieve/issues/324)) ([158e97a](https://github.com/forcedotcom/source-deploy-retrieve/commit/158e97a8fc1e60cf37864120b8b95b08c4ce2982))
* issue supplying connection object when deploying or retrieving ([#226](https://github.com/forcedotcom/source-deploy-retrieve/issues/226)) ([3490652](https://github.com/forcedotcom/source-deploy-retrieve/commit/3490652b5fbbef36d25a5d8e0e0d06aa9adca84d))
* make forceignore exported as a top level feature ([#198](https://github.com/forcedotcom/source-deploy-retrieve/issues/198)) ([82317d9](https://github.com/forcedotcom/source-deploy-retrieve/commit/82317d92b897c1e75c2a256a352b368e0bda3ab3))
* merge deploy api options ([#272](https://github.com/forcedotcom/source-deploy-retrieve/issues/272)) ([162d7cd](https://github.com/forcedotcom/source-deploy-retrieve/commit/162d7cd864f6ae3b63cc4d5e4c9da5f78fa43e2d))
* moved the forceignore deprecation logic to SDR ([#129](https://github.com/forcedotcom/source-deploy-retrieve/issues/129)) ([1b791d7](https://github.com/forcedotcom/source-deploy-retrieve/commit/1b791d754fb23f9497c69314b29ad320204910af))
* NetworkBranding content file not included in source conversion ([#106](https://github.com/forcedotcom/source-deploy-retrieve/issues/106)) ([60f19a7](https://github.com/forcedotcom/source-deploy-retrieve/commit/60f19a7548ee99f29d4b9efe00e712f62e2f0e5d))
* output package creation to follow sfdx package convention ([#153](https://github.com/forcedotcom/source-deploy-retrieve/issues/153)) ([059262f](https://github.com/forcedotcom/source-deploy-retrieve/commit/059262fa51df43556fc0085814e5c70ebd01644e))
* preserve leading zeroes in xml node values ([#319](https://github.com/forcedotcom/source-deploy-retrieve/issues/319)) ([5e934e8](https://github.com/forcedotcom/source-deploy-retrieve/commit/5e934e8512e4231b7da30300fd64792ae1fb39dc))
* prevent duplicate -meta.xml suffix for metadata xml only components ([#188](https://github.com/forcedotcom/source-deploy-retrieve/issues/188)) ([d0f4b17](https://github.com/forcedotcom/source-deploy-retrieve/commit/d0f4b176ceed104f0cdf85530d9cedf844c4bce6))
* recomposition failing for child components ([#112](https://github.com/forcedotcom/source-deploy-retrieve/issues/112)) ([fd4a3ab](https://github.com/forcedotcom/source-deploy-retrieve/commit/fd4a3ab3524c0fc7d51db2993a040594cc11ff0e))
* recomposition failing if no parent xml ([#245](https://github.com/forcedotcom/source-deploy-retrieve/issues/245)) ([4ba5d86](https://github.com/forcedotcom/source-deploy-retrieve/commit/4ba5d86866063aea79243bca3de78d1ff7d28e55))
* remove octet-stream as archive type ([#244](https://github.com/forcedotcom/source-deploy-retrieve/issues/244)) ([10f5332](https://github.com/forcedotcom/source-deploy-retrieve/commit/10f5332c69affdfcfd5a303d3d057c506f21e5d8))
* remove tests from being published ([#203](https://github.com/forcedotcom/source-deploy-retrieve/issues/203)) ([9d599fb](https://github.com/forcedotcom/source-deploy-retrieve/commit/9d599fb746fa26c3e2b0ffcdb87a32ff9eee9bad))
* Resolve decomposed child components correctly ([#174](https://github.com/forcedotcom/source-deploy-retrieve/issues/174)) ([1355cfb](https://github.com/forcedotcom/source-deploy-retrieve/commit/1355cfb73bcc382968dc7613fd3c370ca04dc017))
* resolveComponent no longer tries to resolve ignored dir paths ([#379](https://github.com/forcedotcom/source-deploy-retrieve/issues/379)) ([385933f](https://github.com/forcedotcom/source-deploy-retrieve/commit/385933fd8a7937f0731c3788d34ea88ff3895a91))
* retrieve package names to their respective packages ([#353](https://github.com/forcedotcom/source-deploy-retrieve/issues/353)) ([d127731](https://github.com/forcedotcom/source-deploy-retrieve/commit/d12773125e8d764d2d16b75b91816d5d968acc31))
* retrieve reports correct file outputs ([#210](https://github.com/forcedotcom/source-deploy-retrieve/issues/210)) ([14420da](https://github.com/forcedotcom/source-deploy-retrieve/commit/14420da735fb4147712d926da00cda5a0077e1bb))
* set an overridden apiVersion on a created connection ([#274](https://github.com/forcedotcom/source-deploy-retrieve/issues/274)) ([b6f7896](https://github.com/forcedotcom/source-deploy-retrieve/commit/b6f7896b6206b71f9aa5b0ebc9c117d630073e72))
* static resource size consistency ([#411](https://github.com/forcedotcom/source-deploy-retrieve/issues/411)) ([e903175](https://github.com/forcedotcom/source-deploy-retrieve/commit/e903175f17788c6a6e542f4e588a5ddf9ff7f969))
* support toolbelt suffixes ([#428](https://github.com/forcedotcom/source-deploy-retrieve/issues/428)) ([ad4883b](https://github.com/forcedotcom/source-deploy-retrieve/commit/ad4883b6e68a5a8530c3918d795181b07d1608da))
* throw an error for unexpected child types ([#426](https://github.com/forcedotcom/source-deploy-retrieve/issues/426)) ([c40cd97](https://github.com/forcedotcom/source-deploy-retrieve/commit/c40cd97f5437f2099834a9ad16a15db340353474))
* unzipping some static resources fail ([#260](https://github.com/forcedotcom/source-deploy-retrieve/issues/260)) ([f3a5ec1](https://github.com/forcedotcom/source-deploy-retrieve/commit/f3a5ec11db052f9eac57ab941d7b6b5bf3802fa7))
* update missing config for wave and other types ([#307](https://github.com/forcedotcom/source-deploy-retrieve/issues/307)) ([d9f7cef](https://github.com/forcedotcom/source-deploy-retrieve/commit/d9f7cef68bbdcdb7dc2bfd6aef9957f21d3a8979))
* use MetadataApiDeploy instance methods ([#343](https://github.com/forcedotcom/source-deploy-retrieve/issues/343)) ([29b4b67](https://github.com/forcedotcom/source-deploy-retrieve/commit/29b4b676be1dc2f01d9a0bc9e1ba2ff32f660ccf))
* xml nodes might not be arrays ([#424](https://github.com/forcedotcom/source-deploy-retrieve/issues/424)) ([e48b7c4](https://github.com/forcedotcom/source-deploy-retrieve/commit/e48b7c4ccdfbed554254bacc9b01ea2c873c4d2d))
* xmlns set during source conversion ([#213](https://github.com/forcedotcom/source-deploy-retrieve/issues/213)) ([38f96f5](https://github.com/forcedotcom/source-deploy-retrieve/commit/38f96f5753af3d6bf49fb1ab24e92554c4d6ff58))
* zip tree container adding duplicate entries ([#158](https://github.com/forcedotcom/source-deploy-retrieve/issues/158)) ([76fc388](https://github.com/forcedotcom/source-deploy-retrieve/commit/76fc38832978c03eeac4deb0f5e567797acbf932))

# 4.0.1 - July 28, 2021

## Fixed

- Under-the-hood fixes

- Export runTestResult type (#402) ([PR #395](https://github.com/forcedotcom/source-deploy-retrieve/pull/395))

- Add missing metadata types from toolbelt to the metadata registry ([PR #393](https://github.com/forcedotcom/source-deploy-retrieve/pull/393))

- Ignore duplicate components in server response ([PR #401](https://github.com/forcedotcom/source-deploy-retrieve/pull/401))

- Bump version of archiver for NodeJS v16 ([PR #399](https://github.com/forcedotcom/source-deploy-retrieve/pull/399))

- Add CustomFieldTranslation to metadata registry ([#389](https://github.com/forcedotcom/source-deploy-retrieve/pull/389))

# 4.0.0 - July 16, 2021

## Fixed

- Add support for sourceApiVersion ([PR #381](https://github.com/forcedotcom/source-deploy-retrieve/pull/381))

- Add BatchCalcJobDefinition to metadata registry ([PR #382](https://github.com/forcedotcom/source-deploy-retrieve/pull/382))

- ResolveComponent no longer tries to resolve ignored dir paths ([PR #379](https://github.com/forcedotcom/source-deploy-retrieve/pull/379))

- Match toolbelt for Bot and BotVersion metadata types ([PR #372](https://github.com/forcedotcom/source-deploy-retrieve/pull/372))

- Retrieve package names to their respective packages ([PR #353](https://github.com/forcedotcom/source-deploy-retrieve/pull/353))

# 3.1.1 - July 9, 2021

## Fixed

- Bump version of @salesforce/core to 2.25.1 ([PR #369](https://github.com/forcedotcom/source-deploy-retrieve/pull/369))

- Add WaveComponent to metadata registry ([PR #366](https://github.com/forcedotcom/source-deploy-retrieve/pull/366))

# 3.1.0 - June 30, 2021

## Added

- Update registry to 52.0 with new types ([PR #360](https://github.com/forcedotcom/source-deploy-retrieve/pull/360))

- Add `MetadataApiDeployStatus` to public API ([PR #358](https://github.com/forcedotcom/source-deploy-retrieve/pull/358))

## Fixed

- Fix issue with polling logic not waiting for previous poll to finish ([PR #361](https://github.com/forcedotcom/source-deploy-retrieve/pull/361))

# 3.0.0 - June 10, 2021

## Added

- [BREAKING] Add support for making asynchronous metadata transfers ([PR #334](https://github.com/forcedotcom/source-deploy-retrieve/pull/334))

- Add deployRecentValidation method to MetadataApiDeploy, and checkStatus method to MetadataTransfer classes ([PR #343](https://github.com/forcedotcom/source-deploy-retrieve/pull/343))

- Add option for deploying using REST ([PR #352](https://github.com/forcedotcom/source-deploy-retrieve/pull/352))

# 2.1.5 - June 3, 2021

## Fixed

- Update documentation for open-source ([PR #345](https://github.com/forcedotcom/source-deploy-retrieve/pull/345))

- Add examples ([PR #342](https://github.com/forcedotcom/source-deploy-retrieve/pull/342))

- Export FileProperties from the top level ([PR #335](https://github.com/forcedotcom/source-deploy-retrieve/pull/335))

# 2.1.4 - May 24, 2021

## Added

- Adds option to convert source directly to the specified directory ([PR #332](https://github.com/forcedotcom/source-deploy-retrieve/pull/332))

## Fixed

- Fix cannot split issue ([PR #333](https://github.com/forcedotcom/source-deploy-retrieve/pull/333))

- Improve messaging for force ignore old vs new parsers ([PR #324](https://github.com/forcedotcom/source-deploy-retrieve/pull/324))

- Update change log generation documentation ([PR #329](https://github.com/forcedotcom/source-deploy-retrieve/pull/329))

# 2.1.3 - April 29, 2021

## Fixed

- Preserve leading zeroes in xml node values ([PR #319](https://github.com/forcedotcom/source-deploy-retrieve/pull/319))

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
