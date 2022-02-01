# Supported CLI Metadata Types

This list compares metadata types found in Salesforce v54 with the [metadata registry file](./src/registry/metadataRegistry.json) included in this repository.

This repository is used by both the Salesforce CLIs and Salesforce's VSCode Extensions.

Currently, there are 421/465 supported metadata types.
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
|ActivationPlatform|❌|Not supported, but support could be added|
|ActivitiesSettings|✅||
|AddressSettings|✅||
|AdvAccountForecastSet|✅||
|AdvAcctForecastDimSource|❌|Not supported, but support could be added|
|AdvAcctForecastPeriodGroup|✅||
|AnalyticSnapshot|✅||
|AnalyticsDataServicesSettings|✅||
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
|ApplicationSubtypeDefinition|❌|Not supported, but support could be added|
|AppointmentAssignmentPolicy|❌|Not supported, but support could be added|
|AppointmentSchedulingPolicy|✅||
|ApprovalProcess|✅||
|ArchiveSettings|✅||
|AssignmentRules|✅||
|AssistantContextItem|✅||
|AssistantDefinition|✅||
|AssistantSkillQuickAction|✅||
|AssistantSkillSobjectAction|✅||
|AssistantVersion|✅||
|AssociationEngineSettings|✅||
|AttributeDefinition2|❌|Not supported, but support could be added|
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
|BusinessProcessTypeDefinition|❌|Not supported, but support could be added|
|CMSConnectSource|✅||
|CallCenter|✅||
|CallCenterRoutingMap|✅||
|CallCoachingMediaProvider|⚠️|Supports deploy/retrieve but not source tracking|
|CampaignInfluenceModel|✅||
|CampaignSettings|✅||
|CanvasMetadata|✅||
|CareBenefitVerifySettings|✅||
|CareLimitType|❌|Not supported, but support could be added|
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
|ContractType|❌|Not supported, but support could be added|
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
|CustomValue|❌|Not supported, but support could be added|
|CustomerDataPlatformSettings|✅||
|Dashboard|✅||
|DashboardFolder|✅||
|DataCategoryGroup|✅||
|DataConnectorIngestApi|❌|Not supported, but support could be added|
|DataConnectorS3|✅||
|DataDotComSettings|✅||
|DataMapping|✅||
|DataMappingFieldDefinition|✅||
|DataMappingObjectDefinition|✅||
|DataMappingSchema|✅||
|DataSource|✅||
|DataSourceObject|✅||
|DataSourceTenant|❌|Not supported, but support could be added|
|DataStreamDefinition|✅||
|DecisionTable|✅||
|DecisionTableDatasetLink|✅||
|DelegateGroup|✅||
|DeploymentSettings|✅||
|DevHubSettings|✅||
|DiscoveryAIModel|✅||
|DiscoveryGoal|✅||
|DiscoverySettings|✅||
|DiscoveryStory|❌|Not supported, but support could be added|
|Document|✅||
|DocumentChecklistSettings|✅||
|DocumentFolder|✅||
|DocumentGenerationSetting|✅||
|DocumentType|✅||
|DuplicateRule|✅||
|EACSettings|✅||
|ESignatureConfig|❌|Not supported, but support could be added|
|ESignatureEnvelopeConfig|❌|Not supported, but support could be added|
|EclairGeoData|✅||
|EinsteinAgentSettings|✅||
|EinsteinAssistantSettings|✅||
|EinsteinDealInsightsSettings|✅||
|EinsteinDocumentCaptureSettings|✅||
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
|EntityImplements|✅||
|EscalationRules|✅||
|EssentialsSettings|✅||
|EventSettings|✅||
|ExperienceBundle|✅||
|ExperienceBundleSettings|✅||
|ExplainabilityActionDefinition|❌|Not supported, but support could be added|
|ExplainabilityActionVersion|❌|Not supported, but support could be added|
|ExternalAIModel|❌|Not supported, but support could be added|
|ExternalCredential|❌|Not supported, but support could be added|
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
|IdentityVerificationProcDef|❌|Not supported, but support could be added|
|IdentityVerificationProcDtl|❌|Not supported, but support could be added|
|IdentityVerificationProcFld|❌|Not supported, but support could be added|
|IframeWhiteListUrlSettings|✅||
|InboundCertificate|✅||
|InboundNetworkConnection|✅||
|IncidentMgmtSettings|✅||
|Index|⚠️|Supports deploy/retrieve but not source tracking|
|IndustriesLoyaltySettings|✅||
|IndustriesManufacturingSettings|✅||
|IndustriesSettings|✅||
|InstalledPackage|⚠️|Supports deploy/retrieve but not source tracking|
|InterestTaggingSettings|✅||
|InternalDataConnector|❌|Not supported, but support could be added|
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
|LoyaltyProgramSetup|⚠️|Supports deploy/retrieve but not source tracking|
|MLDataDefinition|✅||
|MLPredictionDefinition|✅||
|MLRecommendationDefinition|✅||
|MacroSettings|✅||
|MailMergeSettings|✅||
|ManagedContentType|⚠️|Supports deploy/retrieve but not source tracking|
|ManagedTopics|✅||
|MapsAndLocationSettings|✅||
|MarketingAppExtActivity|❌|Not supported, but support could be added|
|MarketingAppExtension|❌|Not supported, but support could be added|
|MatchingRules|✅||
|MediaAdSalesSettings|✅||
|MfgProgramTemplate|❌|Not supported, but support could be added|
|MilestoneType|✅||
|MktCalcInsightObjectDef|✅||
|MktDataTranObject|✅||
|MlDomain|✅||
|MobSecurityCertPinConfig|❌|Not supported, but support could be added|
|MobileApplicationDetail|✅||
|MobileSecurityAssignment|❌|Not supported, but support could be added|
|MobileSecurityPolicy|❌|Not supported, but support could be added|
|MobileSecurityPolicySet|❌|Not supported, but support could be added|
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
|OmniDataTransform|✅||
|OmniIntegrationProcedure|✅||
|OmniInteractionAccessConfig|❌|Not supported, but support could be added|
|OmniInteractionConfig|✅||
|OmniScript|✅||
|OmniUiCard|✅||
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
|PermissionSetLicenseDefinition|✅||
|PicklistSettings|✅||
|PicklistValue|❌|Not supported, but support could be added|
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
|ProductAttributeSet|❌|Not supported, but support could be added|
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
|RecordAlertCategory|❌|Not supported, but support could be added|
|RecordAlertDataSource|❌|Not supported, but support could be added|
|RecordPageSettings|✅||
|RecordType|✅||
|RedirectWhitelistUrl|✅||
|RelatedRecordAssocCriteria|❌|Not supported, but support could be added|
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
|ScoreCategory|❌|Not supported, but support could be added|
|ScoreRange|❌|Not supported, but support could be added|
|SearchSettings|✅||
|SecuritySettings|✅||
|ServiceAISetupDefinition|❌|Not supported, but support could be added|
|ServiceAISetupField|❌|Not supported, but support could be added|
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
|SiteSettings|✅||
|Skill|✅||
|SlackApp|✅||
|SocialCustomerServiceSettings|✅||
|SocialProfileSettings|✅||
|SourceTrackingSettings|✅||
|StandardValue|❌|Not supported, but support could be added|
|StandardValueSet|✅||
|StandardValueSetTranslation|✅||
|StaticResource|✅||
|StnryAssetEnvSrcCnfg|✅||
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
|TimelineObjectDefinition|❌|Not supported, but support could be added|
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
|UserProfileSearchScope|✅||
|UserProvisioningConfig|✅||
|ValidationRule|✅||
|VehicleAssetEmssnSrcCnfg|✅||
|ViewDefinition|✅||
|VirtualVisitConfig|❌|Not supported, but support could be added|
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
|WorkflowFlowAction|❌|Not supported, but support could be added|
|WorkflowKnowledgePublish|✅||
|WorkflowOutboundMessage|✅||
|WorkflowRule|✅||
|WorkflowSend|✅||
|WorkflowTask|✅||
|WorkforceEngagementSettings|✅||



## Next Release (v55)
v55 introduces the following new types.  Here's their current level of support

|Metadata Type|Support|Notes|
|:---|:---|:---|
|DataActionDefinition|❌|Not supported, but support could be added|
|Experience|undefined|undefined|
|ExternalDataSrcDescriptor|❌|Not supported, but support could be added|
|ExternalDataTranField|❌|Not supported, but support could be added|
|ExternalDataTranObject|❌|Not supported, but support could be added|
|IndustriesAutomotiveSettings|✅||
|PaymentsManagementEnabledSettings|✅||
|RegisteredExternalService|❌|Not supported, but support could be added|
|SchedulingObjective|❌|Not supported, but support could be added|
|StreamingAppDataConnector|❌|Not supported, but support could be added|
|SubscriptionManagementSettings|✅||
|VoiceSettings|✅||

## Additional Types

> The following types are supported by this library but not in the coverage reports for either version.  These are typically
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
