# Supported CLI Metadata Types

This list compares metadata types found in Salesforce v61 with the [metadata registry file](./src/registry/metadataRegistry.json) included in this repository.

This repository is used by both the Salesforce CLIs and Salesforce's VSCode Extensions.

Currently, there are 576/610 supported metadata types.
For status on any existing gaps, please search or file an issue in the [Salesforce CLI issues only repo](https://github.com/forcedotcom/cli/issues).
To contribute a new metadata type, please see the [Contributing Metadata Types to the Registry](./contributing/metadata.md)

| Metadata Type                          | Support | Notes                                                            |
| :------------------------------------- | :------ | :--------------------------------------------------------------- |
| AIApplication                          | ✅      |                                                                  |
| AIApplicationConfig                    | ✅      |                                                                  |
| AIReplyRecommendationsSettings         | ✅      |                                                                  |
| AIScoringModelDefVersion               | ✅      |                                                                  |
| AIScoringModelDefinition               | ✅      |                                                                  |
| AIUsecaseDefinition                    | ⚠️      | Supports deploy/retrieve but not source tracking                 |
| AccountForecastSettings                | ✅      |                                                                  |
| AccountIntelligenceSettings            | ✅      |                                                                  |
| AccountRelationshipShareRule           | ✅      |                                                                  |
| AccountSettings                        | ✅      |                                                                  |
| AccountingFieldMapping                 | ✅      |                                                                  |
| AccountingModelConfig                  | ✅      |                                                                  |
| AccountingSettings                     | ✅      |                                                                  |
| AcctMgrTargetSettings                  | ✅      |                                                                  |
| ActionLauncherItemDef                  | ✅      |                                                                  |
| ActionLinkGroupTemplate                | ✅      |                                                                  |
| ActionPlanTemplate                     | ✅      |                                                                  |
| ActionableEventOrchDef                 | ✅      |                                                                  |
| ActionableEventTypeDef                 | ✅      |                                                                  |
| ActionableListDefinition               | ✅      |                                                                  |
| ActionsSettings                        | ✅      |                                                                  |
| ActivationPlatform                     | ✅      |                                                                  |
| ActivitiesSettings                     | ✅      |                                                                  |
| ActnblListKeyPrfmIndDef                | ✅      |                                                                  |
| AddressSettings                        | ✅      |                                                                  |
| AdvAccountForecastSet                  | ✅      |                                                                  |
| AdvAcctForecastDimSource               | ✅      |                                                                  |
| AdvAcctForecastPeriodGroup             | ✅      |                                                                  |
| AffinityScoreDefinition                | ✅      |                                                                  |
| Ai4mSettings                           | ✅      |                                                                  |
| AnalyticSnapshot                       | ✅      |                                                                  |
| AnalyticsSettings                      | ✅      |                                                                  |
| AnimationRule                          | ✅      |                                                                  |
| ApexClass                              | ✅      |                                                                  |
| ApexComponent                          | ✅      |                                                                  |
| ApexEmailNotifications                 | ✅      |                                                                  |
| ApexPage                               | ✅      |                                                                  |
| ApexSettings                           | ✅      |                                                                  |
| ApexTestSuite                          | ✅      |                                                                  |
| ApexTrigger                            | ✅      |                                                                  |
| AppAnalyticsSettings                   | ✅      |                                                                  |
| AppExperienceSettings                  | ✅      |                                                                  |
| AppMenu                                | ✅      |                                                                  |
| ApplicationRecordTypeConfig            | ✅      |                                                                  |
| ApplicationSubtypeDefinition           | ✅      |                                                                  |
| AppointmentAssignmentPolicy            | ✅      |                                                                  |
| AppointmentSchedulingPolicy            | ✅      |                                                                  |
| ApprovalProcess                        | ✅      |                                                                  |
| AssessmentConfiguration                | ❌      | Not supported, but support could be added                        |
| AssessmentQuestion                     | ✅      |                                                                  |
| AssessmentQuestionSet                  | ✅      |                                                                  |
| AssignmentRules                        | ✅      |                                                                  |
| AssistantContextItem                   | ✅      |                                                                  |
| AssistantDefinition                    | ✅      |                                                                  |
| AssistantSkillQuickAction              | ✅      |                                                                  |
| AssistantSkillSobjectAction            | ✅      |                                                                  |
| AssistantVersion                       | ✅      |                                                                  |
| AssociationEngineSettings              | ✅      |                                                                  |
| Audience                               | ✅      |                                                                  |
| AuraDefinitionBundle                   | ✅      |                                                                  |
| AuthProvider                           | ✅      |                                                                  |
| AutoResponseRules                      | ✅      |                                                                  |
| AutomatedContactsSettings              | ✅      |                                                                  |
| BatchCalcJobDefinition                 | ✅      |                                                                  |
| BatchProcessJobDefinition              | ✅      |                                                                  |
| BenefitAction                          | ✅      |                                                                  |
| BlacklistedConsumer                    | ✅      |                                                                  |
| BldgEnrgyIntensityCnfg                 | ✅      |                                                                  |
| BlockchainSettings                     | ✅      |                                                                  |
| Bot                                    | ✅      |                                                                  |
| BotBlock                               | ✅      |                                                                  |
| BotBlockVersion                        | ❌      | Not supported, but support could be added                        |
| BotSettings                            | ✅      |                                                                  |
| BotTemplate                            | ✅      |                                                                  |
| BotVersion                             | ✅      |                                                                  |
| BranchManagementSettings               | ✅      |                                                                  |
| BrandingSet                            | ✅      |                                                                  |
| BriefcaseDefinition                    | ✅      |                                                                  |
| BusinessHoursSettings                  | ✅      |                                                                  |
| BusinessProcess                        | ✅      |                                                                  |
| BusinessProcessGroup                   | ✅      |                                                                  |
| BusinessProcessTypeDefinition          | ✅      |                                                                  |
| CMSConnectSource                       | ✅      |                                                                  |
| CallCenter                             | ✅      |                                                                  |
| CallCenterRoutingMap                   | ✅      |                                                                  |
| CallCoachingMediaProvider              | ⚠️      | Supports deploy/retrieve but not source tracking                 |
| CampaignInfluenceModel                 | ✅      |                                                                  |
| CampaignSettings                       | ✅      |                                                                  |
| CanvasMetadata                         | ✅      |                                                                  |
| CareBenefitVerifySettings              | ✅      |                                                                  |
| CareLimitType                          | ✅      |                                                                  |
| CareProviderAfflRoleConfig             | ✅      |                                                                  |
| CareProviderSearchConfig               | ✅      |                                                                  |
| CareRequestConfiguration               | ✅      |                                                                  |
| CareSystemFieldMapping                 | ✅      |                                                                  |
| CaseSettings                           | ✅      |                                                                  |
| CaseSubjectParticle                    | ✅      |                                                                  |
| Certificate                            | ✅      |                                                                  |
| ChannelLayout                          | ✅      |                                                                  |
| ChannelObjectLinkingRule               | ✅      |                                                                  |
| ChatterAnswersSettings                 | ✅      |                                                                  |
| ChatterEmailsMDSettings                | ✅      |                                                                  |
| ChatterExtension                       | ✅      |                                                                  |
| ChatterSettings                        | ✅      |                                                                  |
| ClaimFinancialSettings                 | ✅      |                                                                  |
| ClaimMgmtFoundationEnabledSettings     | ✅      |                                                                  |
| ClauseCatgConfiguration                | ✅      |                                                                  |
| CleanDataService                       | ✅      |                                                                  |
| CodeBuilderSettings                    | ✅      |                                                                  |
| CollectionsDashboardSettings           | ✅      |                                                                  |
| CommandAction                          | ✅      |                                                                  |
| CommerceSettings                       | ✅      |                                                                  |
| CommsServiceConsoleSettings            | ✅      |                                                                  |
| CommunitiesSettings                    | ✅      |                                                                  |
| Community                              | ✅      |                                                                  |
| CommunityTemplateDefinition            | ✅      |                                                                  |
| CommunityThemeDefinition               | ✅      |                                                                  |
| CompactLayout                          | ✅      |                                                                  |
| CompanySettings                        | ✅      |                                                                  |
| ConnectedApp                           | ✅      |                                                                  |
| ConnectedAppSettings                   | ✅      |                                                                  |
| ContentAsset                           | ✅      |                                                                  |
| ContentSettings                        | ✅      |                                                                  |
| ContextDefinition                      | ⚠️      | Supports deploy/retrieve but not source tracking                 |
| ContextUseCaseMapping                  | ❌      | Not supported, but support could be added                        |
| ContractSettings                       | ✅      |                                                                  |
| ContractType                           | ❌      | Not supported, but support could be added                        |
| ConversationChannelDefinition          | ✅      |                                                                  |
| ConversationServiceIntegrationSettings | ✅      |                                                                  |
| ConversationVendorInfo                 | ✅      |                                                                  |
| ConversationalIntelligenceSettings     | ✅      |                                                                  |
| CorsWhitelistOrigin                    | ✅      |                                                                  |
| CspTrustedSite                         | ✅      |                                                                  |
| CurrencySettings                       | ✅      |                                                                  |
| CustomAddressFieldSettings             | ✅      |                                                                  |
| CustomApplication                      | ✅      |                                                                  |
| CustomApplicationComponent             | ✅      |                                                                  |
| CustomFeedFilter                       | ✅      |                                                                  |
| CustomField                            | ✅      |                                                                  |
| CustomHelpMenuSection                  | ✅      |                                                                  |
| CustomIndex                            | ✅      |                                                                  |
| CustomLabels                           | ✅      |                                                                  |
| CustomMetadata                         | ✅      |                                                                  |
| CustomNotificationType                 | ✅      |                                                                  |
| CustomObject                           | ✅      |                                                                  |
| CustomObjectTranslation                | ✅      |                                                                  |
| CustomPageWebLink                      | ✅      |                                                                  |
| CustomPermission                       | ✅      |                                                                  |
| CustomSite                             | ✅      |                                                                  |
| CustomTab                              | ✅      |                                                                  |
| CustomValue                            | ❌      | Not supported, but support could be added                        |
| CustomerDataPlatformSettings           | ✅      |                                                                  |
| CustomizablePropensityScoringSettings  | ✅      |                                                                  |
| Dashboard                              | ✅      |                                                                  |
| DashboardFolder                        | ✅      |                                                                  |
| DataCalcInsightTemplate                | ✅      |                                                                  |
| DataCategoryGroup                      | ✅      |                                                                  |
| DataConnectionParamTmpl                | ❌      | Not supported, but support could be added                        |
| DataConnectorIngestApi                 | ✅      |                                                                  |
| DataConnectorS3                        | ✅      |                                                                  |
| DataDotComSettings                     | ✅      |                                                                  |
| DataImportManagementSettings           | ✅      |                                                                  |
| DataKitObjectTemplate                  | ✅      |                                                                  |
| DataPackageKitDefinition               | ✅      |                                                                  |
| DataPackageKitObject                   | ✅      |                                                                  |
| DataSource                             | ✅      |                                                                  |
| DataSourceBundleDefinition             | ✅      |                                                                  |
| DataSourceObject                       | ✅      |                                                                  |
| DataSourceTenant                       | ✅      |                                                                  |
| DataSrcDataModelFieldMap               | ✅      |                                                                  |
| DataStreamDefinition                   | ✅      |                                                                  |
| DataStreamTemplate                     | ✅      |                                                                  |
| DataWeaveResource                      | ✅      |                                                                  |
| DecisionMatrixDefinition               | ✅      |                                                                  |
| DecisionMatrixDefinitionVersion        | ✅      |                                                                  |
| DecisionTable                          | ✅      |                                                                  |
| DecisionTableDatasetLink               | ✅      |                                                                  |
| DelegateGroup                          | ✅      |                                                                  |
| DeploymentSettings                     | ✅      |                                                                  |
| DevHubSettings                         | ✅      |                                                                  |
| DigitalExperience                      | ✅      |                                                                  |
| DigitalExperienceBundle                | ✅      |                                                                  |
| DigitalExperienceConfig                | ✅      |                                                                  |
| DisclosureDefinition                   | ✅      |                                                                  |
| DisclosureDefinitionVersion            | ✅      |                                                                  |
| DisclosureType                         | ✅      |                                                                  |
| DiscoveryAIModel                       | ✅      |                                                                  |
| DiscoveryGoal                          | ✅      |                                                                  |
| DiscoverySettings                      | ✅      |                                                                  |
| DiscoveryStory                         | ✅      |                                                                  |
| Document                               | ✅      |                                                                  |
| DocumentCategory                       | ✅      |                                                                  |
| DocumentCategoryDocumentType           | ✅      |                                                                  |
| DocumentChecklistSettings              | ✅      |                                                                  |
| DocumentFolder                         | ✅      |                                                                  |
| DocumentGenerationSetting              | ✅      |                                                                  |
| DocumentTemplate                       | ❌      | Not supported, but support could be added (but not for tracking) |
| DocumentType                           | ✅      |                                                                  |
| DuplicateRule                          | ✅      |                                                                  |
| DynamicFormsSettings                   | ✅      |                                                                  |
| DynamicFulfillmentOrchestratorSettings | ✅      |                                                                  |
| EACSettings                            | ✅      |                                                                  |
| ESignatureConfig                       | ✅      |                                                                  |
| ESignatureEnvelopeConfig               | ✅      |                                                                  |
| EclairGeoData                          | ✅      |                                                                  |
| EinsteinAISettings                     | ✅      |                                                                  |
| EinsteinAgentSettings                  | ✅      |                                                                  |
| EinsteinAssistantSettings              | ✅      |                                                                  |
| EinsteinCopilotSettings                | ✅      |                                                                  |
| EinsteinDealInsightsSettings           | ✅      |                                                                  |
| EinsteinDocumentCaptureSettings        | ✅      |                                                                  |
| EinsteinGptSettings                    | ✅      |                                                                  |
| EmailAdministrationSettings            | ✅      |                                                                  |
| EmailFolder                            | ✅      |                                                                  |
| EmailIntegrationSettings               | ✅      |                                                                  |
| EmailServicesFunction                  | ✅      |                                                                  |
| EmailTemplate                          | ✅      |                                                                  |
| EmailTemplateFolder                    | ✅      |                                                                  |
| EmailTemplateSettings                  | ✅      |                                                                  |
| EmbeddedServiceBranding                | ✅      |                                                                  |
| EmbeddedServiceConfig                  | ✅      |                                                                  |
| EmbeddedServiceFlowConfig              | ✅      |                                                                  |
| EmbeddedServiceLiveAgent               | ✅      |                                                                  |
| EmbeddedServiceMenuSettings            | ✅      |                                                                  |
| EmployeeDataSyncProfile                | ❌      | Not supported, but support could be added                        |
| EmployeeFieldAccessSettings            | ✅      |                                                                  |
| EmployeeUserSettings                   | ✅      |                                                                  |
| EnablementMeasureDefinition            | ⚠️      | Supports deploy/retrieve but not source tracking                 |
| EnablementProgramDefinition            | ⚠️      | Supports deploy/retrieve but not source tracking                 |
| EnhancedNotesSettings                  | ✅      |                                                                  |
| EntitlementProcess                     | ✅      |                                                                  |
| EntitlementSettings                    | ✅      |                                                                  |
| EntitlementTemplate                    | ✅      |                                                                  |
| EscalationRules                        | ✅      |                                                                  |
| EssentialsSettings                     | ✅      |                                                                  |
| EventLogObjectSettings                 | ✅      |                                                                  |
| EventSettings                          | ✅      |                                                                  |
| ExperienceBundle                       | ✅      |                                                                  |
| ExperienceBundleSettings               | ✅      |                                                                  |
| ExperiencePropertyTypeBundle           | ✅      |                                                                  |
| ExplainabilityActionDefinition         | ✅      |                                                                  |
| ExplainabilityActionVersion            | ✅      |                                                                  |
| ExplainabilityMsgTemplate              | ✅      |                                                                  |
| ExpressionSetDefinition                | ✅      |                                                                  |
| ExpressionSetDefinitionVersion         | ✅      |                                                                  |
| ExpressionSetObjectAlias               | ✅      |                                                                  |
| ExtDataTranFieldTemplate               | ❌      | Not supported, but support could be added                        |
| ExtDataTranObjectTemplate              | ✅      |                                                                  |
| ExternalAIModel                        | ✅      |                                                                  |
| ExternalAuthIdentityProvider           | ❌      | Not supported, but support could be added                        |
| ExternalClientAppSettings              | ✅      |                                                                  |
| ExternalClientApplication              | ✅      |                                                                  |
| ExternalCredential                     | ✅      |                                                                  |
| ExternalDataConnector                  | ✅      |                                                                  |
| ExternalDataSource                     | ✅      |                                                                  |
| ExternalDataSrcDescriptor              | ❌      | Not supported, but support could be added                        |
| ExternalDataTranField                  | ❌      | Not supported, but support could be added                        |
| ExternalDataTranObject                 | ❌      | Not supported, but support could be added                        |
| ExternalDocStorageConfig               | ❌      | Not supported, but support could be added                        |
| ExternalServiceRegistration            | ✅      |                                                                  |
| ExtlClntAppConfigurablePolicies        | ✅      |                                                                  |
| ExtlClntAppGlobalOauthSettings         | ✅      |                                                                  |
| ExtlClntAppMobileConfigurablePolicies  | ✅      |                                                                  |
| ExtlClntAppMobileSettings              | ✅      |                                                                  |
| ExtlClntAppNotificationSettings        | ✅      |                                                                  |
| ExtlClntAppOauthConfigurablePolicies   | ✅      |                                                                  |
| ExtlClntAppOauthSettings               | ✅      |                                                                  |
| FeatureParameterBoolean                | ✅      |                                                                  |
| FeatureParameterDate                   | ✅      |                                                                  |
| FeatureParameterInteger                | ✅      |                                                                  |
| FieldRestrictionRule                   | ✅      |                                                                  |
| FieldServiceMobileExtension            | ✅      |                                                                  |
| FieldServiceSettings                   | ✅      |                                                                  |
| FieldSet                               | ✅      |                                                                  |
| FieldSrcTrgtRelationship               | ✅      |                                                                  |
| FileUploadAndDownloadSecuritySettings  | ✅      |                                                                  |
| FilesConnectSettings                   | ✅      |                                                                  |
| FlexiPage                              | ✅      |                                                                  |
| Flow                                   | ✅      |                                                                  |
| FlowCategory                           | ✅      |                                                                  |
| FlowDefinition                         | ⚠️      | Supports deploy/retrieve but not source tracking                 |
| FlowSettings                           | ✅      |                                                                  |
| FlowTest                               | ✅      |                                                                  |
| ForecastingFilter                      | ✅      |                                                                  |
| ForecastingFilterCondition             | ✅      |                                                                  |
| ForecastingGroup                       | ✅      |                                                                  |
| ForecastingObjectListSettings          | ✅      |                                                                  |
| ForecastingSettings                    | ✅      |                                                                  |
| ForecastingSourceDefinition            | ✅      |                                                                  |
| ForecastingType                        | ✅      |                                                                  |
| ForecastingTypeSource                  | ✅      |                                                                  |
| FormulaSettings                        | ✅      |                                                                  |
| FuelType                               | ✅      |                                                                  |
| FuelTypeSustnUom                       | ✅      |                                                                  |
| FunctionReference                      | ⚠️      | Supports deploy/retrieve but not source tracking                 |
| FundraisingConfig                      | ✅      |                                                                  |
| GatewayProviderPaymentMethodType       | ✅      |                                                                  |
| GenAiFunction                          | ✅      |                                                                  |
| GenAiPlanner                           | ✅      |                                                                  |
| GenAiPlugin                            | ❌      | Not supported, but support could be added                        |
| GenAiPluginInstructionDef              | ❌      | Not supported, but support could be added                        |
| GlobalValueSet                         | ✅      |                                                                  |
| GlobalValueSetTranslation              | ✅      |                                                                  |
| GoogleAppsSettings                     | ✅      |                                                                  |
| Group                                  | ✅      |                                                                  |
| HighVelocitySalesSettings              | ✅      |                                                                  |
| HomePageComponent                      | ✅      |                                                                  |
| HomePageLayout                         | ✅      |                                                                  |
| IPAddressRange                         | ✅      |                                                                  |
| Icon                                   | ✅      |                                                                  |
| IdeasSettings                          | ✅      |                                                                  |
| IdentityProviderSettings               | ✅      |                                                                  |
| IdentityVerificationProcDef            | ✅      |                                                                  |
| IframeWhiteListUrlSettings             | ✅      |                                                                  |
| InboundCertificate                     | ✅      |                                                                  |
| InboundNetworkConnection               | ✅      |                                                                  |
| IncidentMgmtSettings                   | ✅      |                                                                  |
| IncludeEstTaxInQuoteCPQSettings        | ✅      |                                                                  |
| IncludeEstTaxInQuoteSettings           | ✅      |                                                                  |
| Index                                  | ⚠️      | Supports deploy/retrieve but not source tracking                 |
| IndustriesAutomotiveSettings           | ✅      |                                                                  |
| IndustriesContextSettings              | ✅      |                                                                  |
| IndustriesEinsteinFeatureSettings      | ✅      |                                                                  |
| IndustriesEventOrchSettings            | ✅      |                                                                  |
| IndustriesFieldServiceSettings         | ✅      |                                                                  |
| IndustriesGamificationSettings         | ✅      |                                                                  |
| IndustriesLoyaltySettings              | ✅      |                                                                  |
| IndustriesManufacturingSettings        | ✅      |                                                                  |
| IndustriesPricingSettings              | ✅      |                                                                  |
| IndustriesSettings                     | ✅      |                                                                  |
| IndustriesUnifiedPromotionsSettings    | ✅      |                                                                  |
| InstalledPackage                       | ⚠️      | Supports deploy/retrieve but not source tracking                 |
| IntegrationProviderDef                 | ✅      |                                                                  |
| InterestTaggingSettings                | ✅      |                                                                  |
| InternalDataConnector                  | ✅      |                                                                  |
| InvLatePymntRiskCalcSettings           | ✅      |                                                                  |
| InventorySettings                      | ✅      |                                                                  |
| InvocableActionSettings                | ✅      |                                                                  |
| IoTSettings                            | ✅      |                                                                  |
| KeywordList                            | ✅      |                                                                  |
| KnowledgeGenerationSettings            | ✅      |                                                                  |
| KnowledgeSettings                      | ✅      |                                                                  |
| LanguageSettings                       | ✅      |                                                                  |
| LargeQuotesandOrdersForRlmSettings     | ✅      |                                                                  |
| Layout                                 | ✅      |                                                                  |
| LeadConfigSettings                     | ✅      |                                                                  |
| LeadConvertSettings                    | ✅      |                                                                  |
| LearningAchievementConfig              | ❌      | Not supported, but support could be added                        |
| Letterhead                             | ✅      |                                                                  |
| LicensingSettings                      | ✅      |                                                                  |
| LightningBolt                          | ✅      |                                                                  |
| LightningComponentBundle               | ✅      |                                                                  |
| LightningExperienceSettings            | ✅      |                                                                  |
| LightningExperienceTheme               | ✅      |                                                                  |
| LightningMessageChannel                | ✅      |                                                                  |
| LightningOnboardingConfig              | ✅      |                                                                  |
| ListView                               | ✅      |                                                                  |
| LiveAgentSettings                      | ✅      |                                                                  |
| LiveChatAgentConfig                    | ✅      |                                                                  |
| LiveChatButton                         | ✅      |                                                                  |
| LiveChatDeployment                     | ✅      |                                                                  |
| LiveChatSensitiveDataRule              | ✅      |                                                                  |
| LiveMessageSettings                    | ✅      |                                                                  |
| LocationUse                            | ✅      |                                                                  |
| LoyaltyProgramSetup                    | ⚠️      | Supports deploy/retrieve but not source tracking                 |
| MacroSettings                          | ✅      |                                                                  |
| MailMergeSettings                      | ✅      |                                                                  |
| ManagedContentType                     | ⚠️      | Supports deploy/retrieve but not source tracking                 |
| ManagedEventSubscription               | ✅      |                                                                  |
| ManagedTopics                          | ✅      |                                                                  |
| MapsAndLocationSettings                | ✅      |                                                                  |
| MarketSegmentDefinition                | ✅      |                                                                  |
| MarketingAppExtActivity                | ❌      | Not supported, but support could be added                        |
| MarketingAppExtension                  | ✅      |                                                                  |
| MatchingRules                          | ✅      |                                                                  |
| MediaAdSalesSettings                   | ✅      |                                                                  |
| MeetingsSettings                       | ✅      |                                                                  |
| MessagingChannel                       | ⚠️      | Supports deploy/retrieve but not source tracking                 |
| MfgProgramTemplate                     | ✅      |                                                                  |
| MfgServiceConsoleSettings              | ✅      |                                                                  |
| MilestoneType                          | ✅      |                                                                  |
| MktCalcInsightObjectDef                | ✅      |                                                                  |
| MktDataConnection                      | ❌      | Not supported, but support could be added                        |
| MktDataConnectionCred                  | ❌      | Not supported, but support could be added                        |
| MktDataConnectionParam                 | ❌      | Not supported, but support could be added                        |
| MktDataConnectionSrcParam              | ❌      | Not supported, but support could be added                        |
| MktDataTranObject                      | ✅      |                                                                  |
| MlDomain                               | ✅      |                                                                  |
| MobSecurityCertPinConfig               | ✅      |                                                                  |
| MobileApplicationDetail                | ✅      |                                                                  |
| MobileSecurityAssignment               | ✅      |                                                                  |
| MobileSecurityPolicy                   | ✅      |                                                                  |
| MobileSettings                         | ✅      |                                                                  |
| ModerationRule                         | ✅      |                                                                  |
| MutingPermissionSet                    | ✅      |                                                                  |
| MyDomainDiscoverableLogin              | ✅      |                                                                  |
| MyDomainSettings                       | ✅      |                                                                  |
| NameSettings                           | ✅      |                                                                  |
| NamedCredential                        | ✅      |                                                                  |
| NavigationMenu                         | ✅      |                                                                  |
| Network                                | ✅      |                                                                  |
| NetworkBranding                        | ✅      |                                                                  |
| NotificationTypeConfig                 | ✅      |                                                                  |
| NotificationsSettings                  | ✅      |                                                                  |
| OauthCustomScope                       | ✅      |                                                                  |
| OauthOidcSettings                      | ✅      |                                                                  |
| OauthTokenExchangeHandler              | ✅      |                                                                  |
| ObjectHierarchyRelationship            | ✅      |                                                                  |
| ObjectLinkingSettings                  | ✅      |                                                                  |
| ObjectSourceTargetMap                  | ✅      |                                                                  |
| OcrSampleDocument                      | ✅      |                                                                  |
| OcrTemplate                            | ✅      |                                                                  |
| OmniChannelPricingSettings             | ✅      |                                                                  |
| OmniChannelSettings                    | ✅      |                                                                  |
| OmniDataTransform                      | ⚠️      | Supports deploy/retrieve but not source tracking                 |
| OmniExtTrackingDef                     | ⚠️      | Supports deploy/retrieve but not source tracking                 |
| OmniIntegrationProcedure               | ⚠️      | Supports deploy/retrieve but not source tracking                 |
| OmniInteractionAccessConfig            | ⚠️      | Supports deploy/retrieve but not source tracking                 |
| OmniInteractionConfig                  | ⚠️      | Supports deploy/retrieve but not source tracking                 |
| OmniScript                             | ⚠️      | Supports deploy/retrieve but not source tracking                 |
| OmniSupervisorConfig                   | ✅      |                                                                  |
| OmniTrackingGroup                      | ⚠️      | Supports deploy/retrieve but not source tracking                 |
| OmniUiCard                             | ⚠️      | Supports deploy/retrieve but not source tracking                 |
| OnlineSalesSettings                    | ✅      |                                                                  |
| OpportunityScoreSettings               | ✅      |                                                                  |
| OpportunitySettings                    | ✅      |                                                                  |
| OrderManagementSettings                | ✅      |                                                                  |
| OrderSettings                          | ✅      |                                                                  |
| OrgSettings                            | ✅      |                                                                  |
| OutboundNetworkConnection              | ✅      |                                                                  |
| PardotEinsteinSettings                 | ✅      |                                                                  |
| PardotSettings                         | ✅      |                                                                  |
| ParticipantRole                        | ✅      |                                                                  |
| PartyDataModelSettings                 | ✅      |                                                                  |
| PathAssistant                          | ✅      |                                                                  |
| PathAssistantSettings                  | ✅      |                                                                  |
| PaymentGatewayProvider                 | ✅      |                                                                  |
| PaymentsManagementEnabledSettings      | ✅      |                                                                  |
| PaymentsSettings                       | ✅      |                                                                  |
| PermissionSet                          | ✅      |                                                                  |
| PermissionSetGroup                     | ✅      |                                                                  |
| PermissionSetLicenseDefinition         | ✅      |                                                                  |
| PersonAccountOwnerPowerUser            | ✅      |                                                                  |
| PicklistSettings                       | ✅      |                                                                  |
| PicklistValue                          | ❌      | Not supported, but support could be added                        |
| PipelineInspMetricConfig               | ✅      |                                                                  |
| PlatformCachePartition                 | ✅      |                                                                  |
| PlatformEventChannel                   | ✅      |                                                                  |
| PlatformEventChannelMember             | ✅      |                                                                  |
| PlatformEventSettings                  | ✅      |                                                                  |
| PlatformEventSubscriberConfig          | ✅      |                                                                  |
| PlatformSlackSettings                  | ✅      |                                                                  |
| PortalDelegablePermissionSet           | ❌      | Not supported, but support could be added                        |
| PortalsSettings                        | ✅      |                                                                  |
| PostTemplate                           | ✅      |                                                                  |
| PredictionBuilderSettings              | ✅      |                                                                  |
| PresenceDeclineReason                  | ✅      |                                                                  |
| PresenceUserConfig                     | ✅      |                                                                  |
| PricingActionParameters                | ⚠️      | Supports deploy/retrieve but not source tracking                 |
| PricingRecipe                          | ✅      |                                                                  |
| PrivacySettings                        | ✅      |                                                                  |
| ProcessFlowMigration                   | ✅      |                                                                  |
| ProductAttrDisplayConfig               | ❌      | Not supported, but support could be added                        |
| ProductAttributeSet                    | ✅      |                                                                  |
| ProductConfiguratorSettings            | ✅      |                                                                  |
| ProductSettings                        | ✅      |                                                                  |
| ProductSpecificationRecType            | ❌      | Not supported, but support could be added                        |
| ProductSpecificationType               | ❌      | Not supported, but support could be added                        |
| Profile                                | ✅      |                                                                  |
| ProfilePasswordPolicy                  | ✅      |                                                                  |
| ProfileSessionSetting                  | ✅      |                                                                  |
| Prompt                                 | ✅      |                                                                  |
| Queue                                  | ✅      |                                                                  |
| QueueRoutingConfig                     | ✅      |                                                                  |
| QuickAction                            | ✅      |                                                                  |
| QuickTextSettings                      | ✅      |                                                                  |
| QuoteSettings                          | ✅      |                                                                  |
| RealTimeEventSettings                  | ✅      |                                                                  |
| RecAlrtDataSrcExpSetDef                | ❌      | Not supported, but support could be added                        |
| RecommendationBuilderSettings          | ✅      |                                                                  |
| RecommendationStrategy                 | ✅      |                                                                  |
| RecordActionDeployment                 | ✅      |                                                                  |
| RecordAggregationDefinition            | ✅      |                                                                  |
| RecordAlertCategory                    | ✅      |                                                                  |
| RecordAlertDataSource                  | ✅      |                                                                  |
| RecordAlertTemplate                    | ✅      |                                                                  |
| RecordPageSettings                     | ✅      |                                                                  |
| RecordType                             | ✅      |                                                                  |
| RedirectWhitelistUrl                   | ✅      |                                                                  |
| ReferencedDashboard                    | ❌      | Not supported, but support could be added                        |
| ReferralMarketingSettings              | ✅      |                                                                  |
| RegisteredExternalService              | ✅      |                                                                  |
| RelatedRecordAssocCriteria             | ❌      | Not supported, but support could be added                        |
| RelationshipGraphDefinition            | ✅      |                                                                  |
| RemoteSiteSetting                      | ✅      |                                                                  |
| Report                                 | ✅      |                                                                  |
| ReportFolder                           | ✅      |                                                                  |
| ReportType                             | ✅      |                                                                  |
| RestrictionRule                        | ✅      |                                                                  |
| RetailExecutionSettings                | ✅      |                                                                  |
| RetrievalSummaryDefinition             | ✅      |                                                                  |
| RevenueManagementSettings              | ✅      |                                                                  |
| Role                                   | ✅      |                                                                  |
| SalesAgreementSettings                 | ✅      |                                                                  |
| SalesWorkQueueSettings                 | ✅      |                                                                  |
| SamlSsoConfig                          | ✅      |                                                                  |
| SandboxSettings                        | ✅      |                                                                  |
| SceGlobalModelOptOutSettings           | ✅      |                                                                  |
| SchedulingObjective                    | ✅      |                                                                  |
| SchedulingRule                         | ✅      |                                                                  |
| SchemaSettings                         | ✅      |                                                                  |
| ScoreCategory                          | ✅      |                                                                  |
| SearchCustomization                    | ⚠️      | Supports deploy/retrieve but not source tracking                 |
| SearchOrgWideObjectConfig              | ⚠️      | Supports deploy/retrieve but not source tracking                 |
| SearchSettings                         | ✅      |                                                                  |
| SecuritySettings                       | ✅      |                                                                  |
| ServiceAISetupDefinition               | ✅      |                                                                  |
| ServiceAISetupField                    | ✅      |                                                                  |
| ServiceChannel                         | ✅      |                                                                  |
| ServiceCloudVoiceSettings              | ✅      |                                                                  |
| ServicePresenceStatus                  | ✅      |                                                                  |
| ServiceProcess                         | ✅      |                                                                  |
| ServiceSetupAssistantSettings          | ✅      |                                                                  |
| SharingCriteriaRule                    | ✅      |                                                                  |
| SharingGuestRule                       | ✅      |                                                                  |
| SharingOwnerRule                       | ✅      |                                                                  |
| SharingReason                          | ✅      |                                                                  |
| SharingRules                           | ⚠️      | Supports deploy/retrieve but not source tracking                 |
| SharingSet                             | ✅      |                                                                  |
| SharingSettings                        | ✅      |                                                                  |
| SharingTerritoryRule                   | ✅      |                                                                  |
| SiteDotCom                             | ✅      |                                                                  |
| SiteSettings                           | ✅      |                                                                  |
| Skill                                  | ✅      |                                                                  |
| SkillType                              | ✅      |                                                                  |
| SlackApp                               | ✅      |                                                                  |
| SocialCustomerServiceSettings          | ✅      |                                                                  |
| SourceTrackingSettings                 | ✅      |                                                                  |
| StandardValue                          | ❌      | Not supported, but support could be added                        |
| StandardValueSet                       | ✅      |                                                                  |
| StandardValueSetTranslation            | ✅      |                                                                  |
| StaticResource                         | ✅      |                                                                  |
| StnryAssetEnvSrcCnfg                   | ✅      |                                                                  |
| StreamingAppDataConnector              | ✅      |                                                                  |
| SubscriptionManagementSettings         | ✅      |                                                                  |
| SurveySettings                         | ✅      |                                                                  |
| SustainabilityUom                      | ✅      |                                                                  |
| SustnUomConversion                     | ✅      |                                                                  |
| SvcCatalogCategory                     | ✅      |                                                                  |
| SvcCatalogFilterCriteria               | ✅      |                                                                  |
| SvcCatalogFulfillmentFlow              | ✅      |                                                                  |
| SvcCatalogItemDef                      | ✅      |                                                                  |
| SynonymDictionary                      | ✅      |                                                                  |
| SystemNotificationSettings             | ✅      |                                                                  |
| Territory                              | ✅      |                                                                  |
| Territory2                             | ✅      |                                                                  |
| Territory2Model                        | ✅      |                                                                  |
| Territory2Rule                         | ✅      |                                                                  |
| Territory2Settings                     | ✅      |                                                                  |
| Territory2Type                         | ✅      |                                                                  |
| TimeSheetTemplate                      | ✅      |                                                                  |
| TimelineObjectDefinition               | ✅      |                                                                  |
| TopicsForObjects                       | ✅      |                                                                  |
| TrailheadSettings                      | ✅      |                                                                  |
| TransactionSecurityPolicy              | ✅      |                                                                  |
| Translations                           | ✅      |                                                                  |
| TrialOrgSettings                       | ✅      |                                                                  |
| UIObjectRelationConfig                 | ✅      |                                                                  |
| UiPlugin                               | ✅      |                                                                  |
| UserAccessPolicy                       | ✅      |                                                                  |
| UserAuthCertificate                    | ✅      |                                                                  |
| UserCriteria                           | ✅      |                                                                  |
| UserEngagementSettings                 | ✅      |                                                                  |
| UserInterfaceSettings                  | ✅      |                                                                  |
| UserManagementSettings                 | ✅      |                                                                  |
| UserProfileSearchScope                 | ✅      |                                                                  |
| UserProvisioningConfig                 | ✅      |                                                                  |
| ValidationRule                         | ✅      |                                                                  |
| VehicleAssetEmssnSrcCnfg               | ✅      |                                                                  |
| ViewDefinition                         | ✅      |                                                                  |
| VirtualVisitConfig                     | ❌      | Not supported, but support could be added                        |
| VoiceSettings                          | ✅      |                                                                  |
| WarrantyLifecycleMgmtSettings          | ✅      |                                                                  |
| WaveAnalyticAssetCollection            | ❌      | Not supported, but support could be added                        |
| WaveApplication                        | ✅      |                                                                  |
| WaveComponent                          | ✅      |                                                                  |
| WaveDashboard                          | ✅      |                                                                  |
| WaveDataflow                           | ✅      |                                                                  |
| WaveDataset                            | ✅      |                                                                  |
| WaveLens                               | ✅      |                                                                  |
| WaveRecipe                             | ✅      |                                                                  |
| WaveTemplateBundle                     | ✅      |                                                                  |
| WaveXmd                                | ✅      |                                                                  |
| Web3Settings                           | ✅      |                                                                  |
| WebLink                                | ✅      |                                                                  |
| WebStoreBundle                         | ✅      |                                                                  |
| WebStoreTemplate                       | ✅      |                                                                  |
| WebToXSettings                         | ✅      |                                                                  |
| WorkDotComSettings                     | ✅      |                                                                  |
| WorkSkillRouting                       | ✅      |                                                                  |
| Workflow                               | ✅      |                                                                  |
| WorkflowAlert                          | ✅      |                                                                  |
| WorkflowFieldUpdate                    | ✅      |                                                                  |
| WorkflowFlowAction                     | ❌      | Not supported, but support could be added                        |
| WorkflowKnowledgePublish               | ✅      |                                                                  |
| WorkflowOutboundMessage                | ✅      |                                                                  |
| WorkflowRule                           | ✅      |                                                                  |
| WorkflowSend                           | ✅      |                                                                  |
| WorkflowTask                           | ✅      |                                                                  |
| WorkforceEngagementSettings            | ✅      |                                                                  |

## Next Release (v62)

v62 introduces the following new types. Here's their current level of support

| Metadata Type              | Support | Notes                                     |
| :------------------------- | :------ | :---------------------------------------- |
| AccountPlanSettings        | ✅      |                                           |
| AnalyticsDashboard         | ❌      | Not supported, but support could be added |
| ChannelRevMgmtSettings     | ✅      |                                           |
| ChoiceList                 | ❌      | Not supported, but support could be added |
| DataKitObjectDependency    | ✅      |                                           |
| EnblProgramTaskSubCategory | ✅      |                                           |
| ExtlClntAppPushSettings    | ✅      |                                           |
| GenOpPlanRequestThreshold  | ❌      | Not supported, but support could be added |
| HerokuIntegrationSettings  | ✅      |                                           |
| IndustriesRatingSettings   | ✅      |                                           |
| IndustriesUsageSettings    | ✅      |                                           |
| LearningItemType           | ✅      |                                           |
| StageDefinition            | ❌      | Not supported, but support could be added |

## Additional Types

> The following types are supported by this library but not in the coverage reports for either version. These are typically
>
> 1. types that have been removed from the metadata API but were supported in previous versions
> 1. types that are available for pilots but not officially part of the metadata API (use with caution)
> 1. types that exist only as a child type of other metadata types
> 1. settings types that are automatically supported

- AccessControlPolicy
- AIAssistantTemplate
- AssignmentRule
- AssistantRecommendationType
- AutoResponseRule
- BusinessProcessFeedbackConfiguration
- CallCtrAgentFavTrfrDest
- ConversationMessageDefinition
- ConversationVendorFieldDef
- CustomDataType
- CustomExperience
- CustomLabel
- CustomFieldTranslation
- DataPipeline
- DynamicTrigger
- EmbeddedServiceFieldService
- EntityImplements
- EscalationRule
- EventDelivery
- EventRelayConfig
- EventSubscription
- EventType
- ExpressionSetMessageToken
- extDataTranFieldTemplate
- ExtlClntAppSampleConfigurablePolicies
- ExtlClntAppSampleSettings
- Form
- FormSection
- GenAiPromptTemplate
- GenAiPromptTemplateActv
- GlobalPicklist
- InsightType
- IntegrationHubSettings
- IntegrationHubSettingsType
- InternalOrganization
- LicenseDefinition
- ManagedTopic
- MarketingResourceType
- MatchingRule
- MktDataTranField
- MLDataDefinition
- MlModelArtifact
- MlModelConnection
- MlModelSchema
- MLPredictionDefinition
- MLRecommendationDefinition
- MobileSecurityPolicySet
- Orchestration
- OrchestrationContext
- Portal
- ProductSpecificationTypeDefinition
- Scontrol
- SearchableObjDataSyncInfo
- SearchCriteriaConfiguration
- Settings
- SvcCatalogFilterCondition
- SvcCatalogItemDefFiltrCrit
- UiViewDefinition
- VisualizationPlugin
- WorkSkillRoutingAttribute
- XOrgHub
