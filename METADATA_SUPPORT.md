# Supported CLI Metadata Types

This list compares metadata types found in Salesforce v59 with the [metadata registry file](./src/registry/metadataRegistry.json) included in this repository.

This repository is used by both the Salesforce CLIs and Salesforce's VSCode Extensions.

Currently, there are 542/570 supported metadata types.
For status on any existing gaps, please search or file an issue in the [Salesforce CLI issues only repo](https://github.com/forcedotcom/cli/issues).
To contribute a new metadata type, please see the [Contributing Metadata Types to the Registry](./contributing/metadata.md)

|Metadata Type|Support|Notes|
|:---|:---|:---|
|AIApplication|✅||
|AIApplicationConfig|✅||
|AIReplyRecommendationsSettings|✅||
|AIScoringModelDefVersion|✅||
|AIScoringModelDefinition|✅||
|AIUsecaseDefinition|⚠️|Supports deploy/retrieve but not source tracking|
|AccountForecastSettings|✅||
|AccountIntelligenceSettings|✅||
|AccountRelationshipShareRule|✅||
|AccountSettings|✅||
|AccountingFieldMapping|✅||
|AccountingModelConfig|✅||
|AccountingSettings|✅||
|AcctMgrTargetSettings|✅||
|ActionLauncherItemDef|✅||
|ActionLinkGroupTemplate|✅||
|ActionPlanTemplate|✅||
|ActionableListDefinition|✅||
|ActionsSettings|✅||
|ActivationPlatform|✅||
|ActivitiesSettings|✅||
|AddressSettings|✅||
|AdvAccountForecastSet|✅||
|AdvAcctForecastDimSource|✅||
|AdvAcctForecastPeriodGroup|✅||
|Ai4mSettings|✅||
|AnalyticSnapshot|✅||
|AnalyticsSettings|✅||
|AnimationRule|✅||
|ApexClass|✅||
|ApexComponent|✅||
|ApexEmailNotifications|✅||
|ApexPage|✅||
|ApexSettings|✅||
|ApexTestSuite|✅||
|ApexTrigger|✅||
|AppAnalyticsSettings|✅||
|AppExperienceSettings|✅||
|AppMenu|✅||
|ApplicationRecordTypeConfig|✅||
|ApplicationSubtypeDefinition|✅||
|AppointmentAssignmentPolicy|✅||
|AppointmentSchedulingPolicy|✅||
|ApprovalProcess|✅||
|AssessmentConfiguration|❌|Not supported, but support could be added|
|AssessmentQuestion|✅||
|AssessmentQuestionSet|✅||
|AssignmentRules|✅||
|AssistantContextItem|✅||
|AssistantDefinition|✅||
|AssistantSkillQuickAction|✅||
|AssistantSkillSobjectAction|✅||
|AssistantVersion|✅||
|AssociationEngineSettings|✅||
|Audience|✅||
|AuraDefinitionBundle|✅||
|AuthProvider|✅||
|AutoResponseRules|✅||
|AutomatedContactsSettings|✅||
|BatchCalcJobDefinition|✅||
|BatchProcessJobDefinition|✅||
|BenefitAction|✅||
|BlacklistedConsumer|✅||
|BldgEnrgyIntensityCnfg|✅||
|BlockchainSettings|✅||
|Bot|✅||
|BotBlock|✅||
|BotBlockVersion|❌|Not supported, but support could be added|
|BotSettings|✅||
|BotTemplate|✅||
|BotVersion|✅||
|BranchManagementSettings|✅||
|BrandingSet|✅||
|BriefcaseDefinition|✅||
|BusinessHoursSettings|✅||
|BusinessProcess|✅||
|BusinessProcessGroup|✅||
|BusinessProcessTypeDefinition|✅||
|CMSConnectSource|✅||
|CallCenter|✅||
|CallCenterRoutingMap|✅||
|CallCoachingMediaProvider|⚠️|Supports deploy/retrieve but not source tracking|
|CampaignInfluenceModel|✅||
|CampaignSettings|✅||
|CanvasMetadata|✅||
|CareBenefitVerifySettings|✅||
|CareLimitType|✅||
|CareProviderAfflRoleConfig|✅||
|CareProviderSearchConfig|✅||
|CareRequestConfiguration|✅||
|CareSystemFieldMapping|✅||
|CaseSettings|✅||
|CaseSubjectParticle|✅||
|Certificate|✅||
|ChannelLayout|✅||
|ChannelObjectLinkingRule|✅||
|ChatterAnswersSettings|✅||
|ChatterEmailsMDSettings|✅||
|ChatterExtension|✅||
|ChatterSettings|✅||
|ClaimFinancialSettings|✅||
|ClaimMgmtFoundationEnabledSettings|✅||
|ClauseCatgConfiguration|✅||
|CleanDataService|✅||
|CodeBuilderSettings|✅||
|CollectionsDashboardSettings|✅||
|CommandAction|✅||
|CommerceSettings|✅||
|CommsServiceConsoleSettings|✅||
|CommunitiesSettings|✅||
|Community|✅||
|CommunityTemplateDefinition|✅||
|CommunityThemeDefinition|✅||
|CompactLayout|✅||
|CompanySettings|✅||
|ConnectedApp|✅||
|ConnectedAppSettings|✅||
|ContentAsset|✅||
|ContentSettings|✅||
|ContextDefinition|⚠️|Supports deploy/retrieve but not source tracking|
|ContractSettings|✅||
|ContractType|❌|Not supported, but support could be added|
|ConversationChannelDefinition|✅||
|ConversationServiceIntegrationSettings|✅||
|ConversationVendorInfo|✅||
|ConversationalIntelligenceSettings|✅||
|CorsWhitelistOrigin|✅||
|CspTrustedSite|✅||
|CurrencySettings|✅||
|CustomAddressFieldSettings|✅||
|CustomApplication|✅||
|CustomApplicationComponent|✅||
|CustomFeedFilter|✅||
|CustomField|✅||
|CustomHelpMenuSection|✅||
|CustomIndex|✅||
|CustomLabels|✅||
|CustomMetadata|✅||
|CustomNotificationType|✅||
|CustomObject|✅||
|CustomObjectTranslation|✅||
|CustomPageWebLink|✅||
|CustomPermission|✅||
|CustomSite|✅||
|CustomTab|✅||
|CustomValue|❌|Not supported, but support could be added|
|CustomerDataPlatformSettings|✅||
|CustomizablePropensityScoringSettings|✅||
|Dashboard|✅||
|DashboardFolder|✅||
|DataCalcInsightTemplate|❌|Not supported, but support could be added|
|DataCategoryGroup|✅||
|DataConnectorIngestApi|✅||
|DataConnectorS3|✅||
|DataDotComSettings|✅||
|DataImportManagementSettings|✅||
|DataKitObjectTemplate|❌|Not supported, but support could be added|
|DataPackageKitDefinition|✅||
|DataPackageKitObject|✅||
|DataSource|✅||
|DataSourceBundleDefinition|✅||
|DataSourceObject|✅||
|DataSourceTenant|✅||
|DataSrcDataModelFieldMap|✅||
|DataStreamDefinition|✅||
|DataStreamTemplate|✅||
|DataWeaveResource|✅||
|DecisionMatrixDefinition|✅||
|DecisionMatrixDefinitionVersion|✅||
|DecisionTable|✅||
|DecisionTableDatasetLink|✅||
|DelegateGroup|✅||
|DeploymentSettings|✅||
|DevHubSettings|✅||
|DigitalExperience|✅||
|DigitalExperienceBundle|✅||
|DigitalExperienceConfig|✅||
|DisclosureDefinition|✅||
|DisclosureDefinitionVersion|✅||
|DisclosureType|✅||
|DiscoveryAIModel|✅||
|DiscoveryGoal|✅||
|DiscoverySettings|✅||
|DiscoveryStory|✅||
|Document|✅||
|DocumentCategory|✅||
|DocumentCategoryDocumentType|✅||
|DocumentChecklistSettings|✅||
|DocumentFolder|✅||
|DocumentGenerationSetting|✅||
|DocumentType|✅||
|DuplicateRule|✅||
|DynamicFormsSettings|✅||
|EACSettings|✅||
|ESignatureConfig|✅||
|ESignatureEnvelopeConfig|✅||
|EclairGeoData|✅||
|EinsteinAgentSettings|✅||
|EinsteinAssistantSettings|✅||
|EinsteinDealInsightsSettings|✅||
|EinsteinDocumentCaptureSettings|✅||
|EinsteinGptSettings|✅||
|EmailAdministrationSettings|✅||
|EmailFolder|✅||
|EmailIntegrationSettings|✅||
|EmailServicesFunction|✅||
|EmailTemplate|✅||
|EmailTemplateFolder|✅||
|EmailTemplateSettings|✅||
|EmbeddedServiceBranding|✅||
|EmbeddedServiceConfig|✅||
|EmbeddedServiceFlowConfig|✅||
|EmbeddedServiceLiveAgent|✅||
|EmbeddedServiceMenuSettings|✅||
|EmployeeDataSyncProfile|❌|Not supported, but support could be added|
|EmployeeFieldAccessSettings|✅||
|EmployeeUserSettings|✅||
|EnhancedNotesSettings|✅||
|EntitlementProcess|✅||
|EntitlementSettings|✅||
|EntitlementTemplate|✅||
|EscalationRules|✅||
|EssentialsSettings|✅||
|EventSettings|✅||
|ExperienceBundle|✅||
|ExperienceBundleSettings|✅||
|ExperiencePropertyTypeBundle|✅||
|ExplainabilityActionDefinition|✅||
|ExplainabilityActionVersion|✅||
|ExplainabilityMsgTemplate|✅||
|ExpressionSetDefinition|✅||
|ExpressionSetDefinitionVersion|✅||
|ExpressionSetMessageToken|✅||
|ExpressionSetObjectAlias|❌|Not supported, but support could be added|
|ExternalAIModel|✅||
|ExternalClientAppSettings|✅||
|ExternalClientApplication|✅||
|ExternalCredential|✅||
|ExternalDataConnector|✅||
|ExternalDataSource|✅||
|ExternalDataSrcDescriptor|❌|Not supported, but support could be added|
|ExternalDataTranField|❌|Not supported, but support could be added|
|ExternalDataTranObject|❌|Not supported, but support could be added|
|ExternalDocStorageConfig|❌|Not supported, but support could be added|
|ExternalServiceRegistration|✅||
|ExtlClntAppGlobalOauthSettings|✅||
|ExtlClntAppMobileConfigurablePolicies|✅||
|ExtlClntAppMobileSettings|✅||
|ExtlClntAppOauthConfigurablePolicies|✅||
|ExtlClntAppOauthSettings|✅||
|FeatureParameterBoolean|✅||
|FeatureParameterDate|✅||
|FeatureParameterInteger|✅||
|FieldRestrictionRule|✅||
|FieldServiceMobileExtension|✅||
|FieldServiceSettings|✅||
|FieldSet|✅||
|FieldSrcTrgtRelationship|✅||
|FileUploadAndDownloadSecuritySettings|✅||
|FilesConnectSettings|✅||
|FlexiPage|✅||
|Flow|✅||
|FlowCategory|✅||
|FlowDefinition|⚠️|Supports deploy/retrieve but not source tracking|
|FlowSettings|✅||
|FlowTest|✅||
|ForecastingFilter|✅||
|ForecastingFilterCondition|✅||
|ForecastingObjectListSettings|✅||
|ForecastingSettings|✅||
|ForecastingSourceDefinition|✅||
|ForecastingType|✅||
|ForecastingTypeSource|✅||
|FormulaSettings|✅||
|FuelType|✅||
|FuelTypeSustnUom|✅||
|FunctionReference|⚠️|Supports deploy/retrieve but not source tracking|
|FundraisingConfig|✅||
|GatewayProviderPaymentMethodType|✅||
|GenAiFunction|❌|Not supported, but support could be added|
|GenAiPlugin|❌|Not supported, but support could be added|
|GlobalValueSet|✅||
|GlobalValueSetTranslation|✅||
|GoogleAppsSettings|✅||
|Group|✅||
|HighVelocitySalesSettings|✅||
|HomePageComponent|✅||
|HomePageLayout|✅||
|IPAddressRange|✅||
|Icon|✅||
|IdeasSettings|✅||
|IdentityProviderSettings|✅||
|IdentityVerificationProcDef|✅||
|IframeWhiteListUrlSettings|✅||
|InboundCertificate|✅||
|InboundNetworkConnection|✅||
|IncidentMgmtSettings|✅||
|IncludeEstTaxInQuoteSettings|✅||
|Index|⚠️|Supports deploy/retrieve but not source tracking|
|IndustriesAutomotiveSettings|✅||
|IndustriesContextSettings|✅||
|IndustriesEinsteinFeatureSettings|✅||
|IndustriesLoyaltySettings|✅||
|IndustriesManufacturingSettings|✅||
|IndustriesPricingSettings|✅||
|IndustriesSettings|✅||
|IndustriesUnifiedPromotionsSettings|✅||
|InstalledPackage|⚠️|Supports deploy/retrieve but not source tracking|
|IntegrationProviderDef|✅||
|InterestTaggingSettings|✅||
|InternalDataConnector|✅||
|InvLatePymntRiskCalcSettings|✅||
|InventorySettings|✅||
|InvocableActionSettings|✅||
|IoTSettings|✅||
|KeywordList|✅||
|KnowledgeGenerationSettings|✅||
|KnowledgeSettings|✅||
|LanguageSettings|✅||
|Layout|✅||
|LeadConfigSettings|✅||
|LeadConvertSettings|✅||
|LearningAchievementConfig|❌|Not supported, but support could be added|
|Letterhead|✅||
|LicensingSettings|✅||
|LightningBolt|✅||
|LightningComponentBundle|✅||
|LightningExperienceSettings|✅||
|LightningExperienceTheme|✅||
|LightningMessageChannel|✅||
|LightningOnboardingConfig|✅||
|ListView|✅||
|LiveAgentSettings|✅||
|LiveChatAgentConfig|✅||
|LiveChatButton|✅||
|LiveChatDeployment|✅||
|LiveChatSensitiveDataRule|✅||
|LiveMessageSettings|✅||
|LocationUse|✅||
|LoyaltyProgramSetup|⚠️|Supports deploy/retrieve but not source tracking|
|MacroSettings|✅||
|MailMergeSettings|✅||
|ManagedContentType|⚠️|Supports deploy/retrieve but not source tracking|
|ManagedTopics|✅||
|MapsAndLocationSettings|✅||
|MarketSegmentDefinition|✅||
|MarketingAppExtActivity|❌|Not supported, but support could be added|
|MarketingAppExtension|✅||
|MatchingRules|✅||
|MediaAdSalesSettings|✅||
|MeetingsSettings|✅||
|MessagingChannel|⚠️|Supports deploy/retrieve but not source tracking|
|MfgProgramTemplate|✅||
|MfgServiceConsoleSettings|✅||
|MilestoneType|✅||
|MktCalcInsightObjectDef|✅||
|MktDataTranObject|✅||
|MlDomain|✅||
|MobSecurityCertPinConfig|✅||
|MobileApplicationDetail|✅||
|MobileSecurityAssignment|✅||
|MobileSecurityPolicy|✅||
|MobileSettings|✅||
|ModerationRule|✅||
|MutingPermissionSet|✅||
|MyDomainDiscoverableLogin|✅||
|MyDomainSettings|✅||
|NameSettings|✅||
|NamedCredential|✅||
|NavigationMenu|✅||
|Network|✅||
|NetworkBranding|✅||
|NotificationTypeConfig|✅||
|NotificationsSettings|✅||
|OauthCustomScope|✅||
|OauthOidcSettings|✅||
|ObjectHierarchyRelationship|✅||
|ObjectLinkingSettings|✅||
|ObjectSourceTargetMap|✅||
|OcrSampleDocument|✅||
|OcrTemplate|✅||
|OmniChannelPricingSettings|✅||
|OmniChannelSettings|✅||
|OmniDataTransform|⚠️|Supports deploy/retrieve but not source tracking|
|OmniIntegrationProcedure|⚠️|Supports deploy/retrieve but not source tracking|
|OmniInteractionAccessConfig|⚠️|Supports deploy/retrieve but not source tracking|
|OmniInteractionConfig|⚠️|Supports deploy/retrieve but not source tracking|
|OmniScript|⚠️|Supports deploy/retrieve but not source tracking|
|OmniSupervisorConfig|✅||
|OmniUiCard|⚠️|Supports deploy/retrieve but not source tracking|
|OnlineSalesSettings|✅||
|OpportunityScoreSettings|✅||
|OpportunitySettings|✅||
|OrderManagementSettings|✅||
|OrderSettings|✅||
|OrgSettings|✅||
|OutboundNetworkConnection|✅||
|PardotEinsteinSettings|✅||
|PardotSettings|✅||
|ParticipantRole|✅||
|PartyDataModelSettings|✅||
|PathAssistant|✅||
|PathAssistantSettings|✅||
|PaymentGatewayProvider|✅||
|PaymentsManagementEnabledSettings|✅||
|PaymentsSettings|✅||
|PermissionSet|✅||
|PermissionSetGroup|✅||
|PermissionSetLicenseDefinition|✅||
|PersonAccountOwnerPowerUser|✅||
|PicklistSettings|✅||
|PicklistValue|❌|Not supported, but support could be added|
|PipelineInspMetricConfig|✅||
|PlatformCachePartition|✅||
|PlatformEventChannel|✅||
|PlatformEventChannelMember|✅||
|PlatformEventSettings|✅||
|PlatformEventSubscriberConfig|✅||
|PlatformSlackSettings|✅||
|PortalDelegablePermissionSet|❌|Not supported, but support could be added|
|PortalsSettings|✅||
|PostTemplate|✅||
|PredictionBuilderSettings|✅||
|PresenceDeclineReason|✅||
|PresenceUserConfig|✅||
|PricingRecipe|✅||
|PrivacySettings|✅||
|ProcessFlowMigration|✅||
|ProductAttrDisplayConfig|❌|Not supported, but support could be added|
|ProductAttributeSet|✅||
|ProductSettings|✅||
|ProductSpecificationRecType|❌|Not supported, but support could be added|
|ProductSpecificationType|❌|Not supported, but support could be added|
|Profile|✅||
|ProfilePasswordPolicy|✅||
|ProfileSessionSetting|✅||
|Prompt|✅||
|Queue|✅||
|QueueRoutingConfig|✅||
|QuickAction|✅||
|QuickTextSettings|✅||
|QuoteSettings|✅||
|RealTimeEventSettings|✅||
|RecAlrtDataSrcExpSetDef|❌|Not supported, but support could be added|
|RecommendationBuilderSettings|✅||
|RecommendationStrategy|✅||
|RecordActionDeployment|✅||
|RecordAggregationDefinition|✅||
|RecordAlertCategory|✅||
|RecordAlertDataSource|✅||
|RecordAlertTemplate|❌|Not supported, but support could be added|
|RecordPageSettings|✅||
|RecordType|✅||
|RedirectWhitelistUrl|✅||
|ReferencedDashboard|❌|Not supported, but support could be added|
|ReferralMarketingSettings|✅||
|RegisteredExternalService|✅||
|RelatedRecordAssocCriteria|❌|Not supported, but support could be added|
|RelationshipGraphDefinition|✅||
|RemoteSiteSetting|✅||
|Report|✅||
|ReportFolder|✅||
|ReportType|✅||
|RestrictionRule|✅||
|RetailExecutionSettings|✅||
|Role|✅||
|SalesAgreementSettings|✅||
|SalesWorkQueueSettings|✅||
|SamlSsoConfig|✅||
|SandboxSettings|✅||
|SceGlobalModelOptOutSettings|✅||
|SchedulingObjective|✅||
|SchedulingRule|✅||
|SchemaSettings|✅||
|ScoreCategory|✅||
|SearchSettings|✅||
|SecuritySettings|✅||
|ServiceAISetupDefinition|✅||
|ServiceAISetupField|✅||
|ServiceChannel|✅||
|ServiceCloudVoiceSettings|✅||
|ServicePresenceStatus|✅||
|ServiceProcess|✅||
|ServiceSetupAssistantSettings|✅||
|SharingCriteriaRule|✅||
|SharingGuestRule|✅||
|SharingOwnerRule|✅||
|SharingReason|✅||
|SharingRules|⚠️|Supports deploy/retrieve but not source tracking|
|SharingSet|✅||
|SharingSettings|✅||
|SharingTerritoryRule|✅||
|SiteDotCom|✅||
|SiteSettings|✅||
|Skill|✅||
|SkillType|✅||
|SlackApp|✅||
|SocialCustomerServiceSettings|✅||
|SocialProfileSettings|✅||
|SourceTrackingSettings|✅||
|StandardValue|❌|Not supported, but support could be added|
|StandardValueSet|✅||
|StandardValueSetTranslation|✅||
|StaticResource|✅||
|StnryAssetEnvSrcCnfg|✅||
|StreamingAppDataConnector|✅||
|SubscriptionManagementSettings|✅||
|SurveySettings|✅||
|SustainabilityUom|✅||
|SustnUomConversion|✅||
|SvcCatalogCategory|✅||
|SvcCatalogFulfillmentFlow|✅||
|SvcCatalogItemDef|✅||
|SynonymDictionary|✅||
|SystemNotificationSettings|✅||
|Territory|✅||
|Territory2|✅||
|Territory2Model|✅||
|Territory2Rule|✅||
|Territory2Settings|✅||
|Territory2Type|✅||
|TimeSheetTemplate|✅||
|TimelineObjectDefinition|✅||
|TopicsForObjects|✅||
|TrailheadSettings|✅||
|TransactionSecurityPolicy|✅||
|Translations|✅||
|TrialOrgSettings|✅||
|UIObjectRelationConfig|✅||
|UiPlugin|✅||
|UserAccessPolicy|✅||
|UserAuthCertificate|✅||
|UserCriteria|✅||
|UserEngagementSettings|✅||
|UserInterfaceSettings|✅||
|UserManagementSettings|✅||
|UserProfileSearchScope|✅||
|UserProvisioningConfig|✅||
|ValidationRule|✅||
|VehicleAssetEmssnSrcCnfg|✅||
|ViewDefinition|✅||
|VirtualVisitConfig|❌|Not supported, but support could be added|
|VoiceSettings|✅||
|WarrantyLifecycleMgmtSettings|✅||
|WaveApplication|✅||
|WaveComponent|✅||
|WaveDashboard|✅||
|WaveDataflow|✅||
|WaveDataset|✅||
|WaveLens|✅||
|WaveRecipe|✅||
|WaveTemplateBundle|✅||
|WaveXmd|✅||
|Web3Settings|✅||
|WebLink|✅||
|WebStoreBundle|✅||
|WebStoreTemplate|✅||
|WebToXSettings|✅||
|WorkDotComSettings|✅||
|WorkSkillRouting|✅||
|Workflow|✅||
|WorkflowAlert|✅||
|WorkflowFieldUpdate|✅||
|WorkflowFlowAction|❌|Not supported, but support could be added|
|WorkflowKnowledgePublish|✅||
|WorkflowOutboundMessage|✅||
|WorkflowRule|✅||
|WorkflowSend|✅||
|WorkflowTask|✅||
|WorkforceEngagementSettings|✅||



## Next Release (v60)

v60 introduces the following new types.  Here's their current level of support

|Metadata Type|Support|Notes|
|:---|:---|:---|
|ActionableEventOrchDef|❌|Not supported, but support could be added|
|ActionableEventTypeDef|❌|Not supported, but support could be added|
|ActnblListKeyPrfmIndDef|❌|Not supported, but support could be added|
|CommonEventSubscription|❌|Not supported, but support could be added|
|EinsteinAISettings|✅||
|EventLogObjectSettings|✅||
|ExtDataTranFieldTemplate|✅||
|ExtDataTranObjectTemplate|✅||
|ExtlClntAppConfigurablePolicies|✅||
|ExtlClntAppNotificationSettings|✅||
|GenAiPlanner|❌|Not supported, but support could be added|
|IncludeEstTaxInQuoteCPQSettings|✅||
|IndustriesEventOrchSettings|✅||
|IndustriesFieldServiceSettings|✅||
|IndustriesGamificationSettings|✅||
|ManagedEventSubscription|✅||
|OauthTokenExchangeHandler|❌|Not supported, but support could be added|
|OmniExtTrackingDef|❌|Not supported, but support could be added (but not for tracking)|
|OmniTrackingGroup|❌|Not supported, but support could be added (but not for tracking)|
|PricingActionParameters|❌|Not supported, but support could be added (but not for tracking)|
|ProductConfiguratorSettings|✅||
|RevenueManagementSettings|✅||
|SvcCatalogFilterCriteria|✅||

## Additional Types

> The following types are supported by this library but not in the coverage reports for either version.  These are typically
>
> 1. types that have been removed from the metadata API but were supported in previous versions
> 1. types that are available for pilots but not officially part of the metadata API (use with caution)
> 1. types that exist only as a child type of other metadata types
> 1. settings types that are automatically supported

- MLPredictionDefinition
- MLDataDefinition
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
- ExtlClntAppSampleConfigurablePolicies
- ExtlClntAppSampleSettings
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
- EntityImplements
- WorkSkillRoutingAttribute
- BusinessProcessFeedbackConfiguration
- DynamicTrigger
- MktDataTranField
- ConversationVendorFieldDef
- MLRecommendationDefinition
- InternalOrganization
- SvcCatalogFilterCondition
- SvcCatalogItemDefFiltrCrit
- UiViewDefinition
- MobileSecurityPolicySet
- CallCtrAgentFavTrfrDest
- ProductSpecificationTypeDefinition
- SearchCriteriaConfiguration
- SearchableObjDataSyncInfo
- EventRelayConfig
