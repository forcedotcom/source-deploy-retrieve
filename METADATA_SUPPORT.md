# Supported CLI Metadata Types

This list compares metadata types found in Salesforce v54 with the [metadata registry file](./src/registry/metadataRegistry.json) included in this repository.

This repository is used by both the Salesforce CLIs and Salesforce's VSCode Extensions.

Currently, there are 456/492 supported metadata types.
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
|ActivationPlatform|✅||
|ActivitiesSettings|✅||
|AddressSettings|✅||
|AdvAccountForecastSet|✅||
|AdvAcctForecastDimSource|✅||
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
|ApplicationSubtypeDefinition|✅||
|AppointmentAssignmentPolicy|✅||
|AppointmentSchedulingPolicy|✅||
|ApprovalProcess|✅||
|ArchiveSettings|✅||
|AssessmentQuestion|❌|Not supported, but support could be added|
|AssessmentQuestionSet|❌|Not supported, but support could be added|
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
|BotSettings|✅||
|BotTemplate|❌|Not supported, but support could be added|
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
|CallCtrAgentFavTrfrDest|❌|Not supported, but support could be added|
|CampaignInfluenceModel|✅||
|CampaignSettings|✅||
|CanvasMetadata|✅||
|CareBenefitVerifySettings|✅||
|CareLimitType|✅||
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
|Dashboard|✅||
|DashboardFolder|✅||
|DataCategoryGroup|✅||
|DataConnectorIngestApi|✅||
|DataConnectorS3|✅||
|DataDotComSettings|✅||
|DataImportManagementSettings|✅||
|DataMapping|✅||
|DataMappingFieldDefinition|✅||
|DataMappingObjectDefinition|✅||
|DataMappingSchema|✅||
|DataSource|✅||
|DataSourceObject|✅||
|DataSourceTenant|✅||
|DataStreamDefinition|✅||
|DecisionMatrixDefinition|✅||
|DecisionMatrixDefinitionVersion|✅||
|DecisionTable|✅||
|DecisionTableDatasetLink|✅||
|DelegateGroup|✅||
|DeploymentSettings|✅||
|DevHubSettings|✅||
|DigitalExperience|undefined|undefined|
|DigitalExperienceBundle|undefined|undefined|
|DigitalExperienceBundleSetting|undefined|undefined|
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
|ESignatureConfig|✅||
|ESignatureEnvelopeConfig|✅||
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
|ExplainabilityActionDefinition|✅||
|ExplainabilityActionVersion|✅||
|ExpressionSetDefinition|✅||
|ExpressionSetDefinitionVersion|✅||
|ExternalAIModel|❌|Not supported, but support could be added|
|ExternalCredential|❌|Not supported, but support could be added|
|ExternalDataConnector|✅||
|ExternalDataSource|✅||
|ExternalDataSrcDescriptor|❌|Not supported, but support could be added|
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
|FlowTest|✅||
|ForecastingFilter|❌|Not supported, but support could be added|
|ForecastingFilterCondition|❌|Not supported, but support could be added|
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
|IframeWhiteListUrlSettings|✅||
|InboundCertificate|✅||
|InboundNetworkConnection|✅||
|IncidentMgmtSettings|✅||
|Index|⚠️|Supports deploy/retrieve but not source tracking|
|IndustriesAutomotiveSettings|✅||
|IndustriesLoyaltySettings|✅||
|IndustriesManufacturingSettings|✅||
|IndustriesSettings|✅||
|InstalledPackage|⚠️|Supports deploy/retrieve but not source tracking|
|InterestTaggingSettings|✅||
|InternalDataConnector|✅||
|InvLatePymntRiskCalcSettings|✅||
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
|MarketSegmentDefinition|undefined|undefined|
|MarketingAppExtActivity|❌|Not supported, but support could be added|
|MarketingAppExtension|❌|Not supported, but support could be added|
|MatchingRules|✅||
|MediaAdSalesSettings|✅||
|MeetingsSettings|✅||
|MessagingChannel|undefined|undefined|
|MfgProgramTemplate|❌|Not supported, but support could be added|
|MilestoneType|✅||
|MktCalcInsightObjectDef|✅||
|MktDataTranObject|✅||
|MlDomain|✅||
|MobSecurityCertPinConfig|✅||
|MobileApplicationDetail|✅||
|MobileSecurityAssignment|✅||
|MobileSecurityPolicy|✅||
|MobileSecurityPolicySet|✅||
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
|OmniInteractionAccessConfig|✅||
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
|PaymentsManagementEnabledSettings|✅||
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
|ProductAttributeSet|✅||
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
|RecordAlertCategory|✅||
|RecordAlertDataSource|✅||
|RecordPageSettings|✅||
|RecordType|✅||
|RedirectWhitelistUrl|✅||
|RegisteredExternalService|❌|Not supported, but support could be added|
|RelatedRecordAssocCriteria|❌|Not supported, but support could be added|
|RelationshipGraphDefinition|❌|Not supported, but support could be added|
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
|SchedulingObjective|undefined|undefined|
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
|StreamingAppDataConnector|❌|Not supported, but support could be added|
|SubscriptionManagementSettings|✅||
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
- UiViewDefinition
