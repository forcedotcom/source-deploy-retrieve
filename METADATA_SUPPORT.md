# Supported CLI Metadata Types

This list compares metadata types found in Salesforce v53 with the [metadata registry file](./src/registry/metadataRegistry.json) included in this repository .

Currently, there are 402/417 supported metadata types in Salesforce CLI.
For status on any existing gaps, please search or file an issue in the [Salesforce CLI issues only repo](https://github.com/forcedotcom/cli/issues).
To contribute a new metadata type, please see the [Contributing Metadata Types to the Registry](./contributing/metadata.md)

|Metadata Type|Support|Notes|
|:---|:---|:---|
|AIApplication|✅||
|AIApplicationConfig|✅||
|AIReplyRecommendationsSettings|✅||
|AccountForecastSettings|✅||
|AccountInsightsSettings|✅||
|AccountIntelligenceSettings|✅||
|AccountRelationshipShareRule|✅||
|AccountSettings|✅||
|AcctMgrTargetSettings|✅||
|ActionLinkGroupTemplate|✅||
|ActionPlanTemplate|✅||
|ActionsSettings|✅||
|ActivitiesSettings|✅||
|AddressSettings|✅||
|AdvAccountForecastSet|✅||
|AdvAcctForecastDimSource|❌|Not supported by CLI, but support could be added|
|AdvAcctForecastPeriodGroup|✅||
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
|AppointmentAssignmentPolicy|❌|Not supported by CLI, but support could be added|
|AppointmentSchedulingPolicy|✅||
|ApprovalProcess|✅||
|ArchiveSettings|✅||
|AssignmentRules|✅||
|AssistantContextItem|✅||
|AssistantDefinition|✅||
|AssistantSkillQuickAction|✅||
|AssistantSkillSobjectAction|✅||
|AssistantVersion|✅||
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
|BotSettings|✅||
|BotVersion|✅||
|BranchManagementSettings|✅||
|BrandingSet|✅||
|BriefcaseDefinition|✅||
|BusinessHoursSettings|✅||
|BusinessProcess|✅||
|BusinessProcessGroup|✅||
|CMSConnectSource|✅||
|CallCenter|✅||
|CallCenterRoutingMap|✅||
|CallCoachingMediaProvider|⚠️|Supports deploy/retrieve but not source tracking|
|CampaignInfluenceModel|✅||
|CampaignSettings|✅||
|CanvasMetadata|✅||
|CareBenefitVerifySettings|✅||
|CareLimitType|❌|Not supported by CLI, but support could be added|
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
|CleanDataService|✅||
|CommandAction|✅||
|CommerceSettings|✅||
|CommunitiesSettings|✅||
|Community|✅||
|CommunityTemplateDefinition|✅||
|CommunityThemeDefinition|✅||
|CompactLayout|✅||
|CompanySettings|✅||
|ConnectedApp|✅||
|ConnectedAppSettings|✅||
|ConnectedSystem|✅||
|ContentAsset|✅||
|ContentSettings|✅||
|ContractSettings|✅||
|ConversationVendorInfo|✅||
|ConversationalIntelligenceSettings|✅||
|CorsWhitelistOrigin|✅||
|CspTrustedSite|✅||
|CurrencySettings|✅||
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
|CustomValue|❌|Not supported by CLI, but support could be added|
|CustomerDataPlatformSettings|✅||
|Dashboard|✅||
|DashboardFolder|✅||
|DataCategoryGroup|✅||
|DataConnectorS3|✅||
|DataDotComSettings|✅||
|DataMapping|✅||
|DataMappingSchema|✅||
|DataSource|✅||
|DataSourceObject|✅||
|DataStreamDefinition|✅||
|DecisionTable|✅||
|DecisionTableDatasetLink|✅||
|DelegateGroup|✅||
|DeploymentSettings|✅||
|DevHubSettings|✅||
|DiscoveryAIModel|✅||
|DiscoveryGoal|✅||
|DiscoverySettings|✅||
|Document|✅||
|DocumentChecklistSettings|✅||
|DocumentFolder|✅||
|DocumentGenerationSetting|✅||
|DocumentType|✅||
|DuplicateRule|✅||
|EACSettings|✅||
|EclairGeoData|✅||
|EinsteinAgentSettings|✅||
|EinsteinAssistantSettings|✅||
|EinsteinDocumentCaptureSettings|✅||
|EmailAdministrationSettings|✅||
|EmailFolder|✅||
|EmailIntegrationSettings|✅||
|EmailServicesFunction|✅||
|EmailTemplate|✅||
|EmailTemplateFolder|❌|Not supported by CLI, but support could be added|
|EmailTemplateSettings|✅||
|EmbeddedServiceBranding|✅||
|EmbeddedServiceConfig|✅||
|EmbeddedServiceFlowConfig|✅||
|EmbeddedServiceLiveAgent|✅||
|EmbeddedServiceMenuSettings|✅||
|EmployeeFieldAccessSettings|✅||
|EmployeeUserSettings|✅||
|EnhancedNotesSettings|✅||
|EntitlementProcess|✅||
|EntitlementSettings|✅||
|EntitlementTemplate|✅||
|EntityImplements|✅||
|EscalationRules|✅||
|EssentialsSettings|✅||
|EventSettings|✅||
|ExperienceBundle|✅||
|ExperienceBundleSettings|✅||
|ExternalAIModel|❌|Not supported by CLI, but support could be added|
|ExternalDataConnector|✅||
|ExternalDataSource|✅||
|ExternalServiceRegistration|✅||
|ExternalServicesSettings|✅||
|FeatureParameterBoolean|✅||
|FeatureParameterDate|✅||
|FeatureParameterInteger|✅||
|FederationDataMappingUsage|✅||
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
|ForecastingObjectListSettings|✅||
|ForecastingSettings|✅||
|ForecastingSourceDefinition|✅||
|ForecastingType|✅||
|ForecastingTypeSource|✅||
|FormulaSettings|✅||
|FunctionReference|⚠️|Supports deploy/retrieve but not source tracking|
|GatewayProviderPaymentMethodType|✅||
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
|IframeWhiteListUrlSettings|✅||
|InboundCertificate|✅||
|InboundNetworkConnection|✅||
|Index|⚠️|Supports deploy/retrieve but not source tracking|
|IndustriesLoyaltySettings|✅||
|IndustriesManufacturingSettings|✅||
|IndustriesSettings|✅||
|InstalledPackage|⚠️|Supports deploy/retrieve but not source tracking|
|InventorySettings|✅||
|InvocableActionSettings|✅||
|IoTSettings|✅||
|KeywordList|✅||
|KnowledgeSettings|✅||
|LanguageSettings|✅||
|Layout|✅||
|LeadConfigSettings|✅||
|LeadConvertSettings|✅||
|Letterhead|✅||
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
|MLDataDefinition|✅||
|MLPredictionDefinition|✅||
|MLRecommendationDefinition|✅||
|MacroSettings|✅||
|MailMergeSettings|✅||
|ManagedContentType|⚠️|Supports deploy/retrieve but not source tracking|
|ManagedTopics|✅||
|MapsAndLocationSettings|✅||
|MatchingRules|✅||
|MediaAdSalesSettings|✅||
|MilestoneType|✅||
|MktCalcInsightObjectDef|✅||
|MktDataTranObject|✅||
|MlDomain|✅||
|MobileApplicationDetail|✅||
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
|ObjectHierarchyRelationship|✅||
|ObjectLinkingSettings|✅||
|ObjectSourceTargetMap|✅||
|OcrSampleDocument|✅||
|OcrTemplate|✅||
|OmniChannelSettings|✅||
|OmniInteractionAccessConfig|❌|Not supported by CLI, but support could be added|
|OnlineSalesSettings|✅||
|OpportunityInsightsSettings|✅||
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
|PermissionSet|✅||
|PermissionSetGroup|✅||
|PicklistSettings|✅||
|PicklistValue|❌|Not supported by CLI, but support could be added|
|PlatformCachePartition|✅||
|PlatformEventChannel|✅||
|PlatformEventChannelMember|✅||
|PlatformEventSubscriberConfig|✅||
|PlatformSlackSettings|✅||
|PortalsSettings|✅||
|PostTemplate|✅||
|PredictionBuilderSettings|✅||
|PresenceDeclineReason|✅||
|PresenceUserConfig|✅||
|PrivacySettings|✅||
|ProductSettings|✅||
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
|RecommendationBuilderSettings|✅||
|RecommendationStrategy|✅||
|RecordActionDeployment|✅||
|RecordPageSettings|✅||
|RecordType|✅||
|RedirectWhitelistUrl|✅||
|RelatedRecordAssocCriteria|❌|Not supported by CLI, but support could be added|
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
|SchedulingRule|✅||
|SchemaSettings|✅||
|SearchSettings|✅||
|SecuritySettings|✅||
|ServiceAISetupDefinition|❌|Not supported by CLI, but support could be added|
|ServiceAISetupField|❌|Not supported by CLI, but support could be added|
|ServiceChannel|✅||
|ServiceCloudVoiceSettings|✅||
|ServicePresenceStatus|✅||
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
|Skill|✅||
|SlackApp|✅||
|SocialCustomerServiceSettings|✅||
|SocialProfileSettings|✅||
|SourceTrackingSettings|✅||
|StandardValue|❌|Not supported by CLI, but support could be added|
|StandardValueSet|✅||
|StandardValueSetTranslation|✅||
|StaticResource|✅||
|StnryAssetEnrgyUseCnfg|❌|Not supported by CLI, but support could be added|
|SurveySettings|✅||
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
|TopicsForObjects|✅||
|TrailheadSettings|✅||
|TransactionSecurityPolicy|✅||
|Translations|✅||
|TrialOrgSettings|✅||
|UIObjectRelationConfig|✅||
|UiPlugin|✅||
|UserAuthCertificate|✅||
|UserCriteria|✅||
|UserEngagementSettings|✅||
|UserInterfaceSettings|✅||
|UserManagementSettings|✅||
|UserProvisioningConfig|✅||
|ValidationRule|✅||
|VehAssetEnrgyUseCnfg|❌|Not supported by CLI, but support could be added|
|ViewDefinition|✅||
|WaveApplication|✅||
|WaveComponent|✅||
|WaveDashboard|✅||
|WaveDataflow|✅||
|WaveDataset|✅||
|WaveLens|✅||
|WaveRecipe|✅||
|WaveTemplateBundle|✅||
|WaveXmd|✅||
|WebLink|✅||
|WebStoreTemplate|✅||
|WebToXSettings|✅||
|WorkDotComSettings|✅||
|WorkSkillRouting|✅||
|Workflow|✅||
|WorkflowAlert|✅||
|WorkflowFieldUpdate|✅||
|WorkflowFlowAction|❌|Not supported by CLI, but support could be added|
|WorkflowKnowledgePublish|✅||
|WorkflowOutboundMessage|✅||
|WorkflowRule|✅||
|WorkflowSend|✅||
|WorkflowTask|✅||
|WorkforceEngagementSettings|✅||



## Next Release (v54)
v54 introduces the following new types.  Here's their current level of support

|Metadata Type|Support|Notes|
|:---|:---|:---|
|ActivationPlatform|❌|Not supported by CLI, but support could be added|
|AnalyticsDataServicesSettings|✅||
|ApplicationSubtypeDefinition|❌|Not supported by CLI, but support could be added|
|AssociationEngineSettings|✅||
|AttributeDefinition2|❌|Not supported by CLI, but support could be added|
|BusinessProcessTypeDefinition|❌|Not supported by CLI, but support could be added|
|ContractType|❌|Not supported by CLI, but support could be added|
|DataMappingFieldDefinition|✅||
|DataMappingObjectDefinition|✅||
|DataSourceTenant|❌|Not supported by CLI, but support could be added|
|DiscoveryStory|❌|Not supported by CLI, but support could be added|
|ESignatureConfig|❌|Not supported by CLI, but support could be added|
|ESignatureEnvelopeConfig|❌|Not supported by CLI, but support could be added|
|EinsteinDealInsightsSettings|✅||
|EmployeeDataSyncProfile|❌|Not supported by CLI, but support could be added|
|ExplainabilityActionDefinition|❌|Not supported by CLI, but support could be added|
|ExplainabilityActionVersion|❌|Not supported by CLI, but support could be added|
|ExternalCredential|❌|Not supported by CLI, but support could be added|
|IdentityVerificationProcDef|❌|Not supported by CLI, but support could be added|
|IdentityVerificationProcDtl|❌|Not supported by CLI, but support could be added|
|IdentityVerificationProcFld|❌|Not supported by CLI, but support could be added|
|IncidentMgmtSettings|✅||
|InterestTaggingSettings|✅||
|InternalDataConnector|❌|Not supported by CLI, but support could be added|
|LoyaltyProgramSetup|⚠️|Supports deploy/retrieve but not source tracking|
|MarketingAppExtActivity|❌|Not supported by CLI, but support could be added|
|MarketingAppExtension|❌|Not supported by CLI, but support could be added|
|MfgProgramTemplate|❌|Not supported by CLI, but support could be added|
|MobSecurityCertPinConfig|❌|Not supported by CLI, but support could be added|
|MobileSecurityAssignment|❌|Not supported by CLI, but support could be added|
|MobileSecurityPolicy|❌|Not supported by CLI, but support could be added|
|MobileSecurityPolicySet|❌|Not supported by CLI, but support could be added|
|OmniDataTransform|✅||
|OmniIntegrationProcedure|✅||
|OmniInteractionConfig|❌|Not supported by CLI, but support could be added|
|OmniScript|✅||
|OmniUiCard|✅||
|PermissionSetLicenseDefinition|✅||
|ProductAttributeSet|❌|Not supported by CLI, but support could be added|
|RecordAlertCategory|❌|Not supported by CLI, but support could be added|
|RecordAlertDataSource|❌|Not supported by CLI, but support could be added|
|ScoreCategory|❌|Not supported by CLI, but support could be added|
|SiteSettings|✅||
|StnryAssetEnvSrcCnfg|✅||
|TimelineObjectDefinition|❌|Not supported by CLI, but support could be added|
|UserProfileSearchScope|✅||
|VehicleAssetEmssnSrcCnfg|✅||
|VirtualVisitConfig|❌|Not supported by CLI, but support could be added|

## Additional Types

> The following types are supported by the CLI but not in the coverage reports for either version.  These are typically
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
