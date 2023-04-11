# Supported CLI Metadata Types

This list compares metadata types found in Salesforce v57 with the [metadata registry file](./src/registry/metadataRegistry.json) included in this repository.

This repository is used by both the Salesforce CLIs and Salesforce's VSCode Extensions.

Currently, there are 510/535 supported metadata types.
For status on any existing gaps, please search or file an issue in the [Salesforce CLI issues only repo](https://github.com/forcedotcom/cli/issues).
To contribute a new metadata type, please see the [Contributing Metadata Types to the Registry](./contributing/metadata.md)

| Metadata Type                         | Support | Notes                                                            |
| :------------------------------------ | :------ | :--------------------------------------------------------------- |
| AIApplication                         | ✅      |                                                                  |
| AIApplicationConfig                   | ✅      |                                                                  |
| AIReplyRecommendationsSettings        | ✅      |                                                                  |
| AIUsecaseDefinition                   | ⚠️      | Supports deploy/retrieve but not source tracking                 |
| AccountForecastSettings               | ✅      |                                                                  |
| AccountInsightsSettings               | ✅      |                                                                  |
| AccountIntelligenceSettings           | ✅      |                                                                  |
| AccountRelationshipShareRule          | ✅      |                                                                  |
| AccountSettings                       | ✅      |                                                                  |
| AccountingFieldMapping                | ✅      |                                                                  |
| AccountingModelConfig                 | ✅      |                                                                  |
| AccountingSettings                    | ✅      |                                                                  |
| AcctMgrTargetSettings                 | ✅      |                                                                  |
| ActionLauncherItemDef                 | ✅      |                                                                  |
| ActionLinkGroupTemplate               | ✅      |                                                                  |
| ActionPlanTemplate                    | ✅      |                                                                  |
| ActionableListDefinition              | ✅      |                                                                  |
| ActionsSettings                       | ✅      |                                                                  |
| ActivationPlatform                    | ✅      |                                                                  |
| ActivitiesSettings                    | ✅      |                                                                  |
| AddressSettings                       | ✅      |                                                                  |
| AdvAccountForecastSet                 | ✅      |                                                                  |
| AdvAcctForecastDimSource              | ✅      |                                                                  |
| AdvAcctForecastPeriodGroup            | ✅      |                                                                  |
| AnalyticSnapshot                      | ✅      |                                                                  |
| AnalyticsSettings                     | ✅      |                                                                  |
| AnimationRule                         | ✅      |                                                                  |
| ApexClass                             | ✅      |                                                                  |
| ApexComponent                         | ✅      |                                                                  |
| ApexEmailNotifications                | ✅      |                                                                  |
| ApexPage                              | ✅      |                                                                  |
| ApexSettings                          | ✅      |                                                                  |
| ApexTestSuite                         | ✅      |                                                                  |
| ApexTrigger                           | ✅      |                                                                  |
| AppAnalyticsSettings                  | ✅      |                                                                  |
| AppExperienceSettings                 | ✅      |                                                                  |
| AppExplorationDataConsent             | ❌      | Not supported, but support could be added                        |
| AppMenu                               | ✅      |                                                                  |
| ApplicationRecordTypeConfig           | ✅      |                                                                  |
| ApplicationSubtypeDefinition          | ✅      |                                                                  |
| AppointmentAssignmentPolicy           | ✅      |                                                                  |
| AppointmentSchedulingPolicy           | ✅      |                                                                  |
| ApprovalProcess                       | ✅      |                                                                  |
| ArchiveSettings                       | ✅      |                                                                  |
| AssessmentQuestion                    | ✅      |                                                                  |
| AssessmentQuestionSet                 | ✅      |                                                                  |
| AssignmentRules                       | ✅      |                                                                  |
| AssistantContextItem                  | ✅      |                                                                  |
| AssistantDefinition                   | ✅      |                                                                  |
| AssistantSkillQuickAction             | ✅      |                                                                  |
| AssistantSkillSobjectAction           | ✅      |                                                                  |
| AssistantVersion                      | ✅      |                                                                  |
| AssociationEngineSettings             | ✅      |                                                                  |
| Audience                              | ✅      |                                                                  |
| AuraDefinitionBundle                  | ✅      |                                                                  |
| AuthProvider                          | ✅      |                                                                  |
| AutoResponseRules                     | ✅      |                                                                  |
| AutomatedContactsSettings             | ✅      |                                                                  |
| BatchCalcJobDefinition                | ✅      |                                                                  |
| BatchProcessJobDefinition             | ✅      |                                                                  |
| BenefitAction                         | ✅      |                                                                  |
| BlacklistedConsumer                   | ✅      |                                                                  |
| BldgEnrgyIntensityCnfg                | ✅      |                                                                  |
| BlockchainSettings                    | ✅      |                                                                  |
| Bot                                   | ✅      |                                                                  |
| BotBlock                              | ✅      |                                                                  |
| BotBlockVersion                       | ❌      | Not supported, but support could be added                        |
| BotSettings                           | ✅      |                                                                  |
| BotTemplate                           | ✅      |                                                                  |
| BotVersion                            | ✅      |                                                                  |
| BranchManagementSettings              | ✅      |                                                                  |
| BrandingSet                           | ✅      |                                                                  |
| BriefcaseDefinition                   | ✅      |                                                                  |
| BusinessHoursSettings                 | ✅      |                                                                  |
| BusinessProcess                       | ✅      |                                                                  |
| BusinessProcessGroup                  | ✅      |                                                                  |
| BusinessProcessTypeDefinition         | ✅      |                                                                  |
| CMSConnectSource                      | ✅      |                                                                  |
| CallCenter                            | ✅      |                                                                  |
| CallCenterRoutingMap                  | ✅      |                                                                  |
| CallCoachingMediaProvider             | ⚠️      | Supports deploy/retrieve but not source tracking                 |
| CampaignInfluenceModel                | ✅      |                                                                  |
| CampaignSettings                      | ✅      |                                                                  |
| CanvasMetadata                        | ✅      |                                                                  |
| CareBenefitVerifySettings             | ✅      |                                                                  |
| CareLimitType                         | ✅      |                                                                  |
| CareProviderSearchConfig              | ✅      |                                                                  |
| CareRequestConfiguration              | ✅      |                                                                  |
| CareSystemFieldMapping                | ✅      |                                                                  |
| CaseSettings                          | ✅      |                                                                  |
| CaseSubjectParticle                   | ✅      |                                                                  |
| Certificate                           | ✅      |                                                                  |
| ChannelLayout                         | ✅      |                                                                  |
| ChannelObjectLinkingRule              | ✅      |                                                                  |
| ChatterAnswersSettings                | ✅      |                                                                  |
| ChatterEmailsMDSettings               | ✅      |                                                                  |
| ChatterExtension                      | ✅      |                                                                  |
| ChatterSettings                       | ✅      |                                                                  |
| ClaimFinancialSettings                | ✅      |                                                                  |
| ClauseCatgConfiguration               | ✅      |                                                                  |
| CleanDataService                      | ✅      |                                                                  |
| CollectionsDashboardSettings          | ✅      |                                                                  |
| CommandAction                         | ✅      |                                                                  |
| CommerceSettings                      | ✅      |                                                                  |
| CommunitiesSettings                   | ✅      |                                                                  |
| Community                             | ✅      |                                                                  |
| CommunityTemplateDefinition           | ✅      |                                                                  |
| CommunityThemeDefinition              | ✅      |                                                                  |
| CompactLayout                         | ✅      |                                                                  |
| CompanySettings                       | ✅      |                                                                  |
| ConnectedApp                          | ✅      |                                                                  |
| ConnectedAppSettings                  | ✅      |                                                                  |
| ContentAsset                          | ✅      |                                                                  |
| ContentSettings                       | ✅      |                                                                  |
| ContractSettings                      | ✅      |                                                                  |
| ContractType                          | ❌      | Not supported, but support could be added                        |
| ConversationVendorInfo                | ✅      |                                                                  |
| ConversationalIntelligenceSettings    | ✅      |                                                                  |
| CorsWhitelistOrigin                   | ✅      |                                                                  |
| CspTrustedSite                        | ✅      |                                                                  |
| CurrencySettings                      | ✅      |                                                                  |
| CustomAddressFieldSettings            | ✅      |                                                                  |
| CustomApplication                     | ✅      |                                                                  |
| CustomApplicationComponent            | ✅      |                                                                  |
| CustomFeedFilter                      | ✅      |                                                                  |
| CustomField                           | ✅      |                                                                  |
| CustomHelpMenuSection                 | ✅      |                                                                  |
| CustomIndex                           | ✅      |                                                                  |
| CustomLabels                          | ✅      |                                                                  |
| CustomMetadata                        | ✅      |                                                                  |
| CustomNotificationType                | ✅      |                                                                  |
| CustomObject                          | ✅      |                                                                  |
| CustomObjectTranslation               | ✅      |                                                                  |
| CustomPageWebLink                     | ✅      |                                                                  |
| CustomPermission                      | ✅      |                                                                  |
| CustomSite                            | ✅      |                                                                  |
| CustomTab                             | ✅      |                                                                  |
| CustomValue                           | ❌      | Not supported, but support could be added                        |
| CustomerDataPlatformSettings          | ✅      |                                                                  |
| CustomizablePropensityScoringSettings | ✅      |                                                                  |
| Dashboard                             | ✅      |                                                                  |
| DashboardFolder                       | ✅      |                                                                  |
| DataCategoryGroup                     | ✅      |                                                                  |
| DataConnectorIngestApi                | ✅      |                                                                  |
| DataConnectorS3                       | ✅      |                                                                  |
| DataDotComSettings                    | ✅      |                                                                  |
| DataImportManagementSettings          | ✅      |                                                                  |
| DataPackageKitDefinition              | ✅      |                                                                  |
| DataPackageKitObject                  | ✅      |                                                                  |
| DataSource                            | ✅      |                                                                  |
| DataSourceBundleDefinition            | ✅      |                                                                  |
| DataSourceObject                      | ✅      |                                                                  |
| DataSourceTenant                      | ✅      |                                                                  |
| DataSrcDataModelFieldMap              | ✅      |                                                                  |
| DataStreamDefinition                  | ✅      |                                                                  |
| DataStreamTemplate                    | ✅      |                                                                  |
| DecisionMatrixDefinition              | ✅      |                                                                  |
| DecisionMatrixDefinitionVersion       | ✅      |                                                                  |
| DecisionTable                         | ✅      |                                                                  |
| DecisionTableDatasetLink              | ✅      |                                                                  |
| DelegateGroup                         | ✅      |                                                                  |
| DeploymentSettings                    | ✅      |                                                                  |
| DevHubSettings                        | ✅      |                                                                  |
| DigitalExperience                     | ✅      |                                                                  |
| DigitalExperienceBundle               | ✅      |                                                                  |
| DigitalExperienceConfig               | ✅      |                                                                  |
| DisclosureDefinition                  | ✅      |                                                                  |
| DisclosureDefinitionVersion           | ✅      |                                                                  |
| DisclosureType                        | ✅      |                                                                  |
| DiscoveryAIModel                      | ✅      |                                                                  |
| DiscoveryGoal                         | ✅      |                                                                  |
| DiscoverySettings                     | ✅      |                                                                  |
| DiscoveryStory                        | ❌      | Not supported, but support could be added                        |
| Document                              | ✅      |                                                                  |
| DocumentChecklistSettings             | ✅      |                                                                  |
| DocumentFolder                        | ✅      |                                                                  |
| DocumentGenerationSetting             | ✅      |                                                                  |
| DocumentType                          | ✅      |                                                                  |
| DuplicateRule                         | ✅      |                                                                  |
| EACSettings                           | ✅      |                                                                  |
| ESignatureConfig                      | ✅      |                                                                  |
| ESignatureEnvelopeConfig              | ✅      |                                                                  |
| EclairGeoData                         | ✅      |                                                                  |
| EinsteinAgentSettings                 | ✅      |                                                                  |
| EinsteinAssistantSettings             | ✅      |                                                                  |
| EinsteinDealInsightsSettings          | ✅      |                                                                  |
| EinsteinDocumentCaptureSettings       | ✅      |                                                                  |
| EmailAdministrationSettings           | ✅      |                                                                  |
| EmailFolder                           | ✅      |                                                                  |
| EmailIntegrationSettings              | ✅      |                                                                  |
| EmailServicesFunction                 | ✅      |                                                                  |
| EmailTemplate                         | ✅      |                                                                  |
| EmailTemplateFolder                   | ✅      |                                                                  |
| EmailTemplateSettings                 | ✅      |                                                                  |
| EmbeddedServiceBranding               | ✅      |                                                                  |
| EmbeddedServiceConfig                 | ✅      |                                                                  |
| EmbeddedServiceFlowConfig             | ✅      |                                                                  |
| EmbeddedServiceLiveAgent              | ✅      |                                                                  |
| EmbeddedServiceMenuSettings           | ✅      |                                                                  |
| EmployeeDataSyncProfile               | ❌      | Not supported, but support could be added                        |
| EmployeeFieldAccessSettings           | ✅      |                                                                  |
| EmployeeUserSettings                  | ✅      |                                                                  |
| EnhancedNotesSettings                 | ✅      |                                                                  |
| EntitlementProcess                    | ✅      |                                                                  |
| EntitlementSettings                   | ✅      |                                                                  |
| EntitlementTemplate                   | ✅      |                                                                  |
| EntityImplements                      | ✅      |                                                                  |
| EscalationRules                       | ✅      |                                                                  |
| EssentialsSettings                    | ✅      |                                                                  |
| EventSettings                         | ✅      |                                                                  |
| ExperienceBundle                      | ✅      |                                                                  |
| ExperienceBundleSettings              | ✅      |                                                                  |
| ExplainabilityActionDefinition        | ✅      |                                                                  |
| ExplainabilityActionVersion           | ✅      |                                                                  |
| ExplainabilityMsgTemplate             | ✅      |                                                                  |
| ExpressionSetDefinition               | ✅      |                                                                  |
| ExpressionSetDefinitionVersion        | ✅      |                                                                  |
| ExpressionSetObjectAlias              | ❌      | Not supported, but support could be added                        |
| ExternalAIModel                       | ❌      | Not supported, but support could be added                        |
| ExternalClientAppSettings             | ✅      |                                                                  |
| ExternalClientApplication             | ✅      |                                                                  |
| ExternalCredential                    | ✅      |                                                                  |
| ExternalDataConnector                 | ✅      |                                                                  |
| ExternalDataSource                    | ✅      |                                                                  |
| ExternalDataSrcDescriptor             | ❌      | Not supported, but support could be added                        |
| ExternalDataTranField                 | ❌      | Not supported, but support could be added                        |
| ExternalDataTranObject                | ❌      | Not supported, but support could be added                        |
| ExternalServiceRegistration           | ✅      |                                                                  |
| ExtlClntAppMobileConfigurablePolicies | ✅      |                                                                  |
| ExtlClntAppMobileSettings             | ✅      |                                                                  |
| ExtlClntAppOauthConfigurablePolicies  | ✅      |                                                                  |
| ExtlClntAppOauthSettings              | ✅      |                                                                  |
| FeatureParameterBoolean               | ✅      |                                                                  |
| FeatureParameterDate                  | ✅      |                                                                  |
| FeatureParameterInteger               | ✅      |                                                                  |
| FieldRestrictionRule                  | ✅      |                                                                  |
| FieldServiceMobileExtension           | ✅      |                                                                  |
| FieldServiceSettings                  | ✅      |                                                                  |
| FieldSet                              | ✅      |                                                                  |
| FieldSrcTrgtRelationship              | ✅      |                                                                  |
| FileUploadAndDownloadSecuritySettings | ✅      |                                                                  |
| FilesConnectSettings                  | ✅      |                                                                  |
| FlexiPage                             | ✅      |                                                                  |
| Flow                                  | ✅      |                                                                  |
| FlowCategory                          | ✅      |                                                                  |
| FlowDefinition                        | ⚠️      | Supports deploy/retrieve but not source tracking                 |
| FlowSettings                          | ✅      |                                                                  |
| FlowTest                              | ✅      |                                                                  |
| ForecastingFilter                     | ✅      |                                                                  |
| ForecastingFilterCondition            | ✅      |                                                                  |
| ForecastingObjectListSettings         | ✅      |                                                                  |
| ForecastingSettings                   | ✅      |                                                                  |
| ForecastingSourceDefinition           | ✅      |                                                                  |
| ForecastingType                       | ✅      |                                                                  |
| ForecastingTypeSource                 | ✅      |                                                                  |
| FormulaSettings                       | ✅      |                                                                  |
| FuelType                              | ✅      |                                                                  |
| FuelTypeSustnUom                      | ✅      |                                                                  |
| FunctionReference                     | ⚠️      | Supports deploy/retrieve but not source tracking                 |
| GatewayProviderPaymentMethodType      | ✅      |                                                                  |
| GlobalValueSet                        | ✅      |                                                                  |
| GlobalValueSetTranslation             | ✅      |                                                                  |
| GoogleAppsSettings                    | ✅      |                                                                  |
| Group                                 | ✅      |                                                                  |
| HighVelocitySalesSettings             | ✅      |                                                                  |
| HomePageComponent                     | ✅      |                                                                  |
| HomePageLayout                        | ✅      |                                                                  |
| IPAddressRange                        | ✅      |                                                                  |
| Icon                                  | ✅      |                                                                  |
| IdeasSettings                         | ✅      |                                                                  |
| IdentityProviderSettings              | ✅      |                                                                  |
| IdentityVerificationProcDef           | ✅      |                                                                  |
| IframeWhiteListUrlSettings            | ✅      |                                                                  |
| InboundCertificate                    | ✅      |                                                                  |
| InboundNetworkConnection              | ✅      |                                                                  |
| IncidentMgmtSettings                  | ✅      |                                                                  |
| IncludeEstTaxInQuoteSettings          | ✅      |                                                                  |
| Index                                 | ⚠️      | Supports deploy/retrieve but not source tracking                 |
| IndustriesAutomotiveSettings          | ✅      |                                                                  |
| IndustriesEinsteinFeatureSettings     | ✅      |                                                                  |
| IndustriesLoyaltySettings             | ✅      |                                                                  |
| IndustriesManufacturingSettings       | ✅      |                                                                  |
| IndustriesSettings                    | ✅      |                                                                  |
| InstalledPackage                      | ⚠️      | Supports deploy/retrieve but not source tracking                 |
| IntegrationProviderDef                | ✅      |                                                                  |
| InterestTaggingSettings               | ✅      |                                                                  |
| InternalDataConnector                 | ✅      |                                                                  |
| InvLatePymntRiskCalcSettings          | ✅      |                                                                  |
| InventorySettings                     | ✅      |                                                                  |
| InvocableActionSettings               | ✅      |                                                                  |
| IoTSettings                           | ✅      |                                                                  |
| KeywordList                           | ✅      |                                                                  |
| KnowledgeSettings                     | ✅      |                                                                  |
| LanguageSettings                      | ✅      |                                                                  |
| Layout                                | ✅      |                                                                  |
| LeadConfigSettings                    | ✅      |                                                                  |
| LeadConvertSettings                   | ✅      |                                                                  |
| Letterhead                            | ✅      |                                                                  |
| LightningBolt                         | ✅      |                                                                  |
| LightningComponentBundle              | ✅      |                                                                  |
| LightningExperienceSettings           | ✅      |                                                                  |
| LightningExperienceTheme              | ✅      |                                                                  |
| LightningMessageChannel               | ✅      |                                                                  |
| LightningOnboardingConfig             | ✅      |                                                                  |
| ListView                              | ✅      |                                                                  |
| LiveAgentSettings                     | ✅      |                                                                  |
| LiveChatAgentConfig                   | ✅      |                                                                  |
| LiveChatButton                        | ✅      |                                                                  |
| LiveChatDeployment                    | ✅      |                                                                  |
| LiveChatSensitiveDataRule             | ✅      |                                                                  |
| LiveMessageSettings                   | ✅      |                                                                  |
| LocationUse                           | ✅      |                                                                  |
| LoyaltyProgramSetup                   | ⚠️      | Supports deploy/retrieve but not source tracking                 |
| MLDataDefinition                      | ✅      |                                                                  |
| MLPredictionDefinition                | ✅      |                                                                  |
| MLRecommendationDefinition            | ✅      |                                                                  |
| MacroSettings                         | ✅      |                                                                  |
| MailMergeSettings                     | ✅      |                                                                  |
| ManagedContentType                    | ⚠️      | Supports deploy/retrieve but not source tracking                 |
| ManagedTopics                         | ✅      |                                                                  |
| MapsAndLocationSettings               | ✅      |                                                                  |
| MarketSegmentDefinition               | ✅      |                                                                  |
| MarketingAppExtActivity               | ❌      | Not supported, but support could be added                        |
| MarketingAppExtension                 | ✅      |                                                                  |
| MatchingRules                         | ✅      |                                                                  |
| MediaAdSalesSettings                  | ✅      |                                                                  |
| MeetingsSettings                      | ✅      |                                                                  |
| MessagingChannel                      | ❌      | Not supported, but support could be added (but not for tracking) |
| MfgProgramTemplate                    | ✅      |                                                                  |
| MfgServiceConsoleSettings             | ✅      |                                                                  |
| MilestoneType                         | ✅      |                                                                  |
| MktCalcInsightObjectDef               | ✅      |                                                                  |
| MktDataTranObject                     | ✅      |                                                                  |
| MlDomain                              | ✅      |                                                                  |
| MobSecurityCertPinConfig              | ✅      |                                                                  |
| MobileApplicationDetail               | ✅      |                                                                  |
| MobileSecurityAssignment              | ✅      |                                                                  |
| MobileSecurityPolicy                  | ✅      |                                                                  |
| MobileSettings                        | ✅      |                                                                  |
| ModerationRule                        | ✅      |                                                                  |
| MutingPermissionSet                   | ✅      |                                                                  |
| MyDomainDiscoverableLogin             | ✅      |                                                                  |
| MyDomainSettings                      | ✅      |                                                                  |
| NameSettings                          | ✅      |                                                                  |
| NamedCredential                       | ✅      |                                                                  |
| NavigationMenu                        | ✅      |                                                                  |
| Network                               | ✅      |                                                                  |
| NetworkBranding                       | ✅      |                                                                  |
| NotificationTypeConfig                | ✅      |                                                                  |
| NotificationsSettings                 | ✅      |                                                                  |
| OauthCustomScope                      | ✅      |                                                                  |
| OauthOidcSettings                     | ✅      |                                                                  |
| ObjectHierarchyRelationship           | ✅      |                                                                  |
| ObjectLinkingSettings                 | ✅      |                                                                  |
| ObjectSourceTargetMap                 | ✅      |                                                                  |
| OcrSampleDocument                     | ✅      |                                                                  |
| OcrTemplate                           | ✅      |                                                                  |
| OmniChannelSettings                   | ✅      |                                                                  |
| OmniDataTransform                     | ⚠️      | Supports deploy/retrieve but not source tracking                 |
| OmniIntegrationProcedure              | ⚠️      | Supports deploy/retrieve but not source tracking                 |
| OmniInteractionAccessConfig           | ⚠️      | Supports deploy/retrieve but not source tracking                 |
| OmniInteractionConfig                 | ⚠️      | Supports deploy/retrieve but not source tracking                 |
| OmniScript                            | ⚠️      | Supports deploy/retrieve but not source tracking                 |
| OmniSupervisorConfig                  | ✅      |                                                                  |
| OmniUiCard                            | ⚠️      | Supports deploy/retrieve but not source tracking                 |
| OnlineSalesSettings                   | ✅      |                                                                  |
| OpportunityInsightsSettings           | ✅      |                                                                  |
| OpportunityScoreSettings              | ✅      |                                                                  |
| OpportunitySettings                   | ✅      |                                                                  |
| OrderManagementSettings               | ✅      |                                                                  |
| OrderSettings                         | ✅      |                                                                  |
| OrgSettings                           | ✅      |                                                                  |
| OutboundNetworkConnection             | ✅      |                                                                  |
| PardotEinsteinSettings                | ✅      |                                                                  |
| PardotSettings                        | ✅      |                                                                  |
| ParticipantRole                       | ✅      |                                                                  |
| PartyDataModelSettings                | ✅      |                                                                  |
| PathAssistant                         | ✅      |                                                                  |
| PathAssistantSettings                 | ✅      |                                                                  |
| PaymentGatewayProvider                | ✅      |                                                                  |
| PaymentsIngestEnabledSettings         | ✅      |                                                                  |
| PaymentsManagementEnabledSettings     | ✅      |                                                                  |
| PaymentsSettings                      | ✅      |                                                                  |
| PermissionSet                         | ✅      |                                                                  |
| PermissionSetGroup                    | ✅      |                                                                  |
| PermissionSetLicenseDefinition        | ✅      |                                                                  |
| PersonAccountOwnerPowerUser           | ✅      |                                                                  |
| PicklistSettings                      | ✅      |                                                                  |
| PicklistValue                         | ❌      | Not supported, but support could be added                        |
| PipelineInspMetricConfig              | ✅      |                                                                  |
| PlatformCachePartition                | ✅      |                                                                  |
| PlatformEventChannel                  | ✅      |                                                                  |
| PlatformEventChannelMember            | ✅      |                                                                  |
| PlatformEventSubscriberConfig         | ✅      |                                                                  |
| PlatformSlackSettings                 | ✅      |                                                                  |
| PortalDelegablePermissionSet          | ❌      | Not supported, but support could be added                        |
| PortalsSettings                       | ✅      |                                                                  |
| PostTemplate                          | ✅      |                                                                  |
| PredictionBuilderSettings             | ✅      |                                                                  |
| PresenceDeclineReason                 | ✅      |                                                                  |
| PresenceUserConfig                    | ✅      |                                                                  |
| PrivacySettings                       | ✅      |                                                                  |
| ProductAttributeSet                   | ✅      |                                                                  |
| ProductSettings                       | ✅      |                                                                  |
| ProductSpecificationTypeDefinition    | ✅      |                                                                  |
| Profile                               | ✅      |                                                                  |
| ProfilePasswordPolicy                 | ✅      |                                                                  |
| ProfileSessionSetting                 | ✅      |                                                                  |
| Prompt                                | ✅      |                                                                  |
| Queue                                 | ✅      |                                                                  |
| QueueRoutingConfig                    | ✅      |                                                                  |
| QuickAction                           | ✅      |                                                                  |
| QuickTextSettings                     | ✅      |                                                                  |
| QuoteSettings                         | ✅      |                                                                  |
| RealTimeEventSettings                 | ✅      |                                                                  |
| RecommendationBuilderSettings         | ✅      |                                                                  |
| RecommendationStrategy                | ✅      |                                                                  |
| RecordActionDeployment                | ✅      |                                                                  |
| RecordAlertCategory                   | ✅      |                                                                  |
| RecordAlertDataSource                 | ✅      |                                                                  |
| RecordPageSettings                    | ✅      |                                                                  |
| RecordType                            | ✅      |                                                                  |
| RedirectWhitelistUrl                  | ✅      |                                                                  |
| ReferencedDashboard                   | ❌      | Not supported, but support could be added                        |
| RegisteredExternalService             | ❌      | Not supported, but support could be added                        |
| RelatedRecordAssocCriteria            | ❌      | Not supported, but support could be added                        |
| RelationshipGraphDefinition           | ✅      |                                                                  |
| RemoteSiteSetting                     | ✅      |                                                                  |
| Report                                | ✅      |                                                                  |
| ReportFolder                          | ✅      |                                                                  |
| ReportType                            | ✅      |                                                                  |
| RestrictionRule                       | ✅      |                                                                  |
| RetailExecutionSettings               | ✅      |                                                                  |
| Role                                  | ✅      |                                                                  |
| SalesAgreementSettings                | ✅      |                                                                  |
| SalesWorkQueueSettings                | ✅      |                                                                  |
| SamlSsoConfig                         | ✅      |                                                                  |
| SandboxSettings                       | ✅      |                                                                  |
| SchedulingObjective                   | ✅      |                                                                  |
| SchedulingRule                        | ✅      |                                                                  |
| SchemaSettings                        | ✅      |                                                                  |
| ScoreCategory                         | ❌      | Not supported, but support could be added                        |
| SearchSettings                        | ✅      |                                                                  |
| SecuritySettings                      | ✅      |                                                                  |
| ServiceAISetupDefinition              | ✅      |                                                                  |
| ServiceAISetupField                   | ✅      |                                                                  |
| ServiceChannel                        | ✅      |                                                                  |
| ServiceCloudVoiceSettings             | ✅      |                                                                  |
| ServicePresenceStatus                 | ✅      |                                                                  |
| ServiceProcess                        | ❌      | Not supported, but support could be added                        |
| ServiceSetupAssistantSettings         | ✅      |                                                                  |
| SharingCriteriaRule                   | ✅      |                                                                  |
| SharingGuestRule                      | ✅      |                                                                  |
| SharingOwnerRule                      | ✅      |                                                                  |
| SharingReason                         | ✅      |                                                                  |
| SharingRules                          | ⚠️      | Supports deploy/retrieve but not source tracking                 |
| SharingSet                            | ✅      |                                                                  |
| SharingSettings                       | ✅      |                                                                  |
| SharingTerritoryRule                  | ✅      |                                                                  |
| SiteDotCom                            | ✅      |                                                                  |
| SiteSettings                          | ✅      |                                                                  |
| Skill                                 | ✅      |                                                                  |
| SlackApp                              | ✅      |                                                                  |
| SocialCustomerServiceSettings         | ✅      |                                                                  |
| SocialProfileSettings                 | ✅      |                                                                  |
| SourceTrackingSettings                | ✅      |                                                                  |
| StandardValue                         | ❌      | Not supported, but support could be added                        |
| StandardValueSet                      | ✅      |                                                                  |
| StandardValueSetTranslation           | ✅      |                                                                  |
| StaticResource                        | ✅      |                                                                  |
| StnryAssetEnvSrcCnfg                  | ✅      |                                                                  |
| StreamingAppDataConnector             | ✅      |                                                                  |
| SubscriptionManagementSettings        | ✅      |                                                                  |
| SurveySettings                        | ✅      |                                                                  |
| SustainabilityUom                     | ✅      |                                                                  |
| SustnUomConversion                    | ✅      |                                                                  |
| SvcCatalogCategory                    | ✅      |                                                                  |
| SvcCatalogFulfillmentFlow             | ✅      |                                                                  |
| SvcCatalogItemDef                     | ✅      |                                                                  |
| SynonymDictionary                     | ✅      |                                                                  |
| SystemNotificationSettings            | ✅      |                                                                  |
| Territory                             | ✅      |                                                                  |
| Territory2                            | ✅      |                                                                  |
| Territory2Model                       | ✅      |                                                                  |
| Territory2Rule                        | ✅      |                                                                  |
| Territory2Settings                    | ✅      |                                                                  |
| Territory2Type                        | ✅      |                                                                  |
| TimeSheetTemplate                     | ✅      |                                                                  |
| TimelineObjectDefinition              | ✅      |                                                                  |
| TopicsForObjects                      | ✅      |                                                                  |
| TrailheadSettings                     | ✅      |                                                                  |
| TransactionSecurityPolicy             | ✅      |                                                                  |
| Translations                          | ✅      |                                                                  |
| TrialOrgSettings                      | ✅      |                                                                  |
| UIObjectRelationConfig                | ✅      |                                                                  |
| UiPlugin                              | ✅      |                                                                  |
| UserAccessPolicy                      | ❌      | Not supported, but support could be added                        |
| UserAuthCertificate                   | ✅      |                                                                  |
| UserCriteria                          | ✅      |                                                                  |
| UserEngagementSettings                | ✅      |                                                                  |
| UserInterfaceSettings                 | ✅      |                                                                  |
| UserManagementSettings                | ✅      |                                                                  |
| UserProfileSearchScope                | ✅      |                                                                  |
| UserProvisioningConfig                | ✅      |                                                                  |
| ValidationRule                        | ✅      |                                                                  |
| VehicleAssetEmssnSrcCnfg              | ✅      |                                                                  |
| ViewDefinition                        | ✅      |                                                                  |
| VirtualVisitConfig                    | ❌      | Not supported, but support could be added                        |
| VoiceSettings                         | ✅      |                                                                  |
| WarrantyLifecycleMgmtSettings         | ✅      |                                                                  |
| WaveAnalyticAssetCollection           | ❌      | Not supported, but support could be added                        |
| WaveApplication                       | ✅      |                                                                  |
| WaveComponent                         | ✅      |                                                                  |
| WaveDashboard                         | ✅      |                                                                  |
| WaveDataflow                          | ✅      |                                                                  |
| WaveDataset                           | ✅      |                                                                  |
| WaveLens                              | ✅      |                                                                  |
| WaveRecipe                            | ✅      |                                                                  |
| WaveTemplateBundle                    | ✅      |                                                                  |
| WaveXmd                               | ✅      |                                                                  |
| WebLink                               | ✅      |                                                                  |
| WebStoreTemplate                      | ✅      |                                                                  |
| WebToXSettings                        | ✅      |                                                                  |
| WorkDotComSettings                    | ✅      |                                                                  |
| WorkSkillRouting                      | ✅      |                                                                  |
| Workflow                              | ✅      |                                                                  |
| WorkflowAlert                         | ✅      |                                                                  |
| WorkflowFieldUpdate                   | ✅      |                                                                  |
| WorkflowFlowAction                    | ❌      | Not supported, but support could be added                        |
| WorkflowKnowledgePublish              | ✅      |                                                                  |
| WorkflowOutboundMessage               | ✅      |                                                                  |
| WorkflowRule                          | ✅      |                                                                  |
| WorkflowSend                          | ✅      |                                                                  |
| WorkflowTask                          | ✅      |                                                                  |
| WorkforceEngagementSettings           | ✅      |                                                                  |

## Next Release (v58)

v58 introduces the following new types. Here's their current level of support

| Metadata Type                      | Support | Notes                                                            |
| :--------------------------------- | :------ | :--------------------------------------------------------------- |
| AIScoringModelDefVersion           | ❌      | Not supported, but support could be added (but not for tracking) |
| AIScoringModelDefinition           | ❌      | Not supported, but support could be added (but not for tracking) |
| Ai4mSettings                       | ✅      |                                                                  |
| AssessmentConfiguration            | ❌      | Not supported, but support could be added                        |
| ClaimMgmtFoundationEnabledSettings | ✅      |                                                                  |
| CodeBuilderSettings                | ✅      |                                                                  |
| DataWeaveResource                  | ✅      |                                                                  |
| DynamicFormsSettings               | ✅      |                                                                  |
| ExperiencePropertyTypeBundle       | ✅      |                                                                  |
| ExternalDocStorageConfig           | ❌      | Not supported, but support could be added                        |
| ExtlClntAppGlobalOauthSettings     | ✅      |                                                                  |
| FundraisingConfig                  | ❌      | Not supported, but support could be added                        |
| LicensingSettings                  | ✅      |                                                                  |
| OmniChannelPricingSettings         | ✅      |                                                                  |
| PlatformEventSettings              | ✅      |                                                                  |
| ProcessFlowMigration               | ❌      | Not supported, but support could be added                        |
| ProductAttrDisplayConfig           | ❌      | Not supported, but support could be added                        |
| ProductSpecificationRecType        | ❌      | Not supported, but support could be added                        |
| ProductSpecificationType           | ❌      | Not supported, but support could be added                        |
| RecAlrtDataSrcExpSetDef            | ❌      | Not supported, but support could be added                        |
| RecordAlertTemplate                | ❌      | Not supported, but support could be added                        |
| SkillType                          | ❌      | Not supported, but support could be added                        |
| Web3Settings                       | ✅      |                                                                  |
| WebStoreBundle                     | ❌      | Not supported, but support could be added                        |

## Additional Types

> The following types are supported by this library but not in the coverage reports for either version. These are typically
>
> 1. types that have been removed from the metadata API but were supported in previous versions
> 1. types that are available for pilots but not officially part of the metadata API (use with caution)
> 1. types that exist only as a child type of other metadata types
> 1. settings types that are automatically supported

- CustomLabel
- Scontrol
- CustomDataType
- GlobalPicklist
- VisualizationPlugin
- Form
- FormSection
- Portal
- EmbeddedServiceFieldService
- EventType
- EventSubscription
- EventDelivery
- AssignmentRule
- AutoResponseRule
- EscalationRule
- CustomFieldTranslation
- MatchingRule
- MarketingResourceType
- CustomExperience
- ManagedTopic
- DataPipeline
- LicenseDefinition
- AccessControlPolicy
- XOrgHub
- AssistantRecommendationType
- InsightType
- IntegrationHubSettingsType
- IntegrationHubSettings
- OrchestrationContext
- Orchestration
- AIAssistantTemplate
- Settings
- WorkSkillRoutingAttribute
- BusinessProcessFeedbackConfiguration
- DynamicTrigger
- MktDataTranField
- ConversationVendorFieldDef
- InternalOrganization
- UiViewDefinition
- MobileSecurityPolicySet
- CallCtrAgentFavTrfrDest
