# Supported CLI Metadata Types

This list compares metadata types found in Salesforce v63 with the [metadata registry file](./src/registry/metadataRegistry.json) included in this repository.

This repository is used by both the Salesforce CLIs and Salesforce's VSCode Extensions.

Currently, there are 631/663 supported metadata types.
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
|AccountPlanObjMeasCalcDef|❌|Not supported, but support could be added|
|AccountPlanSettings|✅||
|AccountRelationshipShareRule|✅||
|AccountSettings|✅||
|AccountingFieldMapping|✅||
|AccountingModelConfig|✅||
|AccountingSettings|✅||
|AcctMgrTargetSettings|✅||
|ActionLauncherItemDef|✅||
|ActionLinkGroupTemplate|✅||
|ActionPlanTemplate|✅||
|ActionableEventOrchDef|✅||
|ActionableEventTypeDef|✅||
|ActionableListDefinition|✅||
|ActionsSettings|✅||
|ActivationPlatform|✅||
|ActivitiesSettings|✅||
|ActnblListKeyPrfmIndDef|✅||
|AddressSettings|✅||
|AdvAccountForecastSet|✅||
|AdvAcctForecastDimSource|✅||
|AdvAcctForecastPeriodGroup|✅||
|AffinityScoreDefinition|✅||
|AgentforceForDevelopersSettings|✅||
|Ai4mSettings|✅||
|AiPluginUtteranceDef|❌|Not supported, but support could be added|
|AnalyticSnapshot|✅||
|AnalyticsDashboard|❌|Not supported, but support could be added|
|AnalyticsSettings|✅||
|AnalyticsWorkspace|✅||
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
|AppFrameworkTemplateBundle|✅||
|AppMenu|✅||
|ApplicationRecordTypeConfig|✅||
|ApplicationSubtypeDefinition|✅||
|AppointmentAssignmentPolicy|✅||
|AppointmentSchedulingPolicy|✅||
|ApprovalProcess|✅||
|AssessmentConfiguration|✅||
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
|BatchCalcJobDefinition|✅||
|BatchProcessJobDefinition|✅||
|BenefitAction|✅||
|BillingSettings|✅||
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
|ChannelRevMgmtSettings|✅||
|ChatterAnswersSettings|✅||
|ChatterEmailsMDSettings|✅||
|ChatterExtension|✅||
|ChatterSettings|✅||
|ChoiceList|⚠️|Supports deploy/retrieve but not source tracking|
|ClaimFinancialSettings|✅||
|ClaimMgmtFoundationEnabledSettings|✅||
|ClauseCatgConfiguration|✅||
|CleanDataService|✅||
|CmsnStmtLineItemConfig|❌|Not supported, but support could be added|
|CmsnStmtLineItemTypConfig|❌|Not supported, but support could be added|
|CodeBuilderSettings|✅||
|CollectionsDashboardSettings|✅||
|CommandAction|✅||
|CommerceSettings|✅||
|CommissionStatementConfig|❌|Not supported, but support could be added|
|CommsServiceConsoleSettings|✅||
|CommunicationChannelType|❌|Not supported, but support could be added|
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
|ContextUseCaseMapping|✅||
|ContractSettings|✅||
|ContractType|✅||
|ConvIntelligenceSignalRule|✅||
|ConversationChannelDefinition|✅||
|ConversationMessageDefinition|✅||
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
|CustomFieldDisplay|❌|Not supported, but support could be added|
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
|DataCalcInsightTemplate|✅||
|DataCategoryGroup|✅||
|DataConnectorIngestApi|✅||
|DataConnectorS3|✅||
|DataDotComSettings|✅||
|DataImportManagementSettings|✅||
|DataKitObjectDependency|✅||
|DataKitObjectTemplate|✅||
|DataObjectSearchIndexConf|❌|Not supported, but support could be added (but not for tracking)|
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
|DocumentTemplate|⚠️|Supports deploy/retrieve but not source tracking|
|DocumentType|✅||
|DuplicateRule|✅||
|DynamicFormsSettings|✅||
|DynamicFulfillmentOrchestratorSettings|✅||
|EACSettings|✅||
|ESignatureConfig|✅||
|ESignatureEnvelopeConfig|✅||
|EclairGeoData|✅||
|EinsteinAISettings|✅||
|EinsteinAgentSettings|✅||
|EinsteinAssistantSettings|✅||
|EinsteinCopilotSettings|✅||
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
|EmployeeDataSyncProfile|✅||
|EmployeeFieldAccessSettings|✅||
|EmployeeUserSettings|✅||
|EnablementMeasureDefinition|✅||
|EnablementProgramDefinition|✅||
|EnblProgramTaskSubCategory|✅||
|EnhancedNotesSettings|✅||
|EntitlementProcess|✅||
|EntitlementSettings|✅||
|EntitlementTemplate|✅||
|EscalationRules|✅||
|EssentialsSettings|✅||
|EventLogObjectSettings|✅||
|EventRelayConfig|✅||
|EventSettings|✅||
|EvfSettings|✅||
|ExperienceBundle|✅||
|ExperienceBundleSettings|✅||
|ExperiencePropertyTypeBundle|✅||
|ExplainabilityActionDefinition|✅||
|ExplainabilityActionVersion|✅||
|ExplainabilityMsgTemplate|✅||
|ExpressionSetDefinition|✅||
|ExpressionSetDefinitionVersion|✅||
|ExpressionSetMessageToken|✅||
|ExpressionSetObjectAlias|✅||
|ExtDataTranFieldTemplate|❌|Not supported, but support could be added|
|ExtDataTranObjectTemplate|✅||
|ExternalAIModel|✅||
|ExternalAuthIdentityProvider|✅||
|ExternalClientAppSettings|✅||
|ExternalClientApplication|✅||
|ExternalCredential|✅||
|ExternalDataConnector|✅||
|ExternalDataSource|✅||
|ExternalDataSrcDescriptor|❌|Not supported, but support could be added|
|ExternalDataTranField|❌|Not supported, but support could be added|
|ExternalDataTranObject|✅||
|ExternalDocStorageConfig|✅||
|ExternalServiceRegistration|✅||
|ExtlClntAppConfigurablePolicies|✅||
|ExtlClntAppGlobalOauthSettings|✅||
|ExtlClntAppMobileConfigurablePolicies|✅||
|ExtlClntAppMobileSettings|✅||
|ExtlClntAppNotificationSettings|✅||
|ExtlClntAppOauthConfigurablePolicies|✅||
|ExtlClntAppOauthSettings|✅||
|ExtlClntAppPushConfigurablePolicies|✅||
|ExtlClntAppPushSettings|✅||
|ExtlClntAppSamlConfigurablePolicies|✅||
|FeatureParameterBoolean|✅||
|FeatureParameterDate|✅||
|FeatureParameterInteger|✅||
|FieldMappingConfig|❌|Not supported, but support could be added|
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
|ForecastingGroup|✅||
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
|GenAiFunction|✅||
|GenAiPlanner|✅||
|GenAiPlugin|✅||
|GenAiPluginInstructionDef|❌|Not supported, but support could be added|
|GenAiPromptTemplate|⚠️|Supports deploy/retrieve but not source tracking|
|GenAiPromptTemplateActv|⚠️|Supports deploy/retrieve but not source tracking|
|GlobalValueSet|✅||
|GlobalValueSetTranslation|✅||
|GoogleAppsSettings|✅||
|Group|✅||
|HerokuIntegrationSettings|✅||
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
|IncludeEstTaxInQuoteCPQSettings|✅||
|IncludeEstTaxInQuoteSettings|✅||
|Index|⚠️|Supports deploy/retrieve but not source tracking|
|IndustriesAutomotiveSettings|✅||
|IndustriesChannelPartnerInventorySettings|✅||
|IndustriesContextSettings|✅||
|IndustriesEinsteinFeatureSettings|✅||
|IndustriesEventOrchSettings|✅||
|IndustriesFieldServiceSettings|✅||
|IndustriesGamificationSettings|✅||
|IndustriesLoyaltySettings|✅||
|IndustriesLsCommercialSettings|✅||
|IndustriesManufacturingSettings|✅||
|IndustriesPricingSettings|✅||
|IndustriesRatingSettings|✅||
|IndustriesSettings|✅||
|IndustriesUnifiedPromotionsSettings|✅||
|IndustriesUsageSettings|✅||
|InsPlcyCoverageSpecConfig|❌|Not supported, but support could be added|
|InsPlcyLineOfBusConfig|❌|Not supported, but support could be added|
|InsPolicyLifecycleConfig|❌|Not supported, but support could be added|
|InsPolicyManagementConfig|❌|Not supported, but support could be added|
|InsRatePlanCmsnConfig|❌|Not supported, but support could be added|
|InsRatePlanTypeConfig|❌|Not supported, but support could be added|
|InstalledPackage|⚠️|Supports deploy/retrieve but not source tracking|
|InsuranceBrokerageSettings|✅||
|IntegrationProviderDef|✅||
|InterestTaggingSettings|✅||
|InternalDataConnector|✅||
|InvLatePymntRiskCalcSettings|✅||
|InventoryReplenishmentSettings|✅||
|InventorySettings|✅||
|InvocableActionSettings|✅||
|IoTSettings|✅||
|KeywordList|✅||
|KnowledgeGenerationSettings|✅||
|KnowledgeSettings|✅||
|LaborCostOptimizationSettings|✅||
|LanguageSettings|✅||
|LargeQuotesandOrdersForRlmSettings|✅||
|Layout|✅||
|LeadConfigSettings|✅||
|LeadConvertSettings|✅||
|LearningAchievementConfig|✅||
|LearningItemType|✅||
|Letterhead|✅||
|LicensingSettings|✅||
|LifeSciConfigCategory|❌|Not supported, but support could be added|
|LifeSciConfigRecord|❌|Not supported, but support could be added|
|LightningBolt|✅||
|LightningComponentBundle|✅||
|LightningExperienceSettings|✅||
|LightningExperienceTheme|✅||
|LightningMessageChannel|✅||
|LightningOnboardingConfig|✅||
|LightningTypeBundle|⚠️|Supports deploy/retrieve but not source tracking|
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
|ManagedEventSubscription|✅||
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
|MktDataConnection|✅||
|MktDataConnectionParam|❌|Not supported, but support could be added|
|MktDataConnectionSrcParam|✅||
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
|OauthTokenExchangeHandler|✅||
|ObjectHierarchyRelationship|✅||
|ObjectLinkingSettings|✅||
|ObjectSourceTargetMap|✅||
|OcrSampleDocument|✅||
|OcrTemplate|✅||
|OmniChannelPricingSettings|✅||
|OmniChannelSettings|✅||
|OmniDataTransform|⚠️|Supports deploy/retrieve but not source tracking|
|OmniExtTrackingDef|⚠️|Supports deploy/retrieve but not source tracking|
|OmniIntegrationProcedure|⚠️|Supports deploy/retrieve but not source tracking|
|OmniInteractionAccessConfig|⚠️|Supports deploy/retrieve but not source tracking|
|OmniInteractionConfig|⚠️|Supports deploy/retrieve but not source tracking|
|OmniScript|⚠️|Supports deploy/retrieve but not source tracking|
|OmniStudioSettings|✅||
|OmniSupervisorConfig|✅||
|OmniTrackingGroup|⚠️|Supports deploy/retrieve but not source tracking|
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
|PortalDelegablePermissionSet|✅||
|PortalsSettings|✅||
|PostTemplate|✅||
|PredictionBuilderSettings|✅||
|PresenceDeclineReason|✅||
|PresenceUserConfig|✅||
|PricingActionParameters|✅||
|PricingRecipe|✅||
|PrivacySettings|✅||
|ProcedureOutputResolution|❌|Not supported, but support could be added (but not for tracking)|
|ProcessFlowMigration|✅||
|ProductAttrDisplayConfig|✅||
|ProductAttributeSet|✅||
|ProductConfiguratorSettings|✅||
|ProductDiscoverySettings|✅||
|ProductSettings|✅||
|ProductSpecificationRecType|✅||
|ProductSpecificationType|✅||
|Profile|✅||
|ProfilePasswordPolicy|✅||
|ProfileSessionSetting|✅||
|Prompt|✅||
|PublicKeyCertificate|⚠️|Supports deploy/retrieve but not source tracking|
|PublicKeyCertificateSet|⚠️|Supports deploy/retrieve but not source tracking|
|Queue|✅||
|QueueRoutingConfig|✅||
|QuickAction|✅||
|QuickTextSettings|✅||
|QuoteSettings|✅||
|RealTimeEventSettings|✅||
|RecAlrtDataSrcExpSetDef|✅||
|RecommendationBuilderSettings|✅||
|RecommendationStrategy|✅||
|RecordActionDeployment|✅||
|RecordAggregationDefinition|✅||
|RecordAlertCategory|✅||
|RecordAlertDataSource|✅||
|RecordAlertTemplate|✅||
|RecordPageSettings|✅||
|RecordType|✅||
|RedirectWhitelistUrl|✅||
|ReferencedDashboard|✅||
|ReferralMarketingSettings|✅||
|RegisteredExternalService|✅||
|RelatedRecordAccessDef|❌|Not supported, but support could be added|
|RelatedRecordAssocCriteria|✅||
|RelationshipGraphDefinition|✅||
|RemoteSiteSetting|✅||
|Report|✅||
|ReportFolder|✅||
|ReportType|✅||
|RestrictionRule|✅||
|RetailExecutionSettings|✅||
|RetrievalSummaryDefinition|✅||
|RevenueManagementSettings|✅||
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
|SearchCustomization|⚠️|Supports deploy/retrieve but not source tracking|
|SearchOrgWideObjectConfig|⚠️|Supports deploy/retrieve but not source tracking|
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
|SourceTrackingSettings|✅||
|StageDefinition|✅||
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
|SvcCatalogFilterCriteria|✅||
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
|TransactionProcessingType|❌|Not supported, but support could be added (but not for tracking)|
|TransactionSecurityPolicy|✅||
|Translations|✅||
|TrialOrgSettings|✅||
|UIObjectRelationConfig|✅||
|UiFormatSpecificationSet|✅||
|UiPlugin|✅||
|UserAccessPolicy|✅||
|UserAuthCertificate|✅||
|UserCriteria|✅||
|UserEngagementSettings|✅||
|UserInterfaceSettings|✅||
|UserManagementSettings|✅||
|UserProvisioningConfig|✅||
|ValidationRule|✅||
|VehicleAssetEmssnSrcCnfg|✅||
|ViewDefinition|✅||
|VirtualVisitConfig|✅||
|VoiceSettings|✅||
|WarrantyLifecycleMgmtSettings|✅||
|WaveAnalyticAssetCollection|✅||
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
|WorkflowFlowAction|✅||
|WorkflowFlowAutomation|❌|Not supported, but support could be added|
|WorkflowKnowledgePublish|✅||
|WorkflowOutboundMessage|✅||
|WorkflowRule|✅||
|WorkflowSend|✅||
|WorkflowTask|✅||
|WorkforceEngagementSettings|✅||



## Next Release (v64)

> **Note**
> v64 coverage not available at this time

## Additional Types

> The following types are supported by this library but not in the coverage reports for either version.  These are typically
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
- EventSubscription
- EventType
- extDataTranFieldTemplate
- ExtlClntAppSampleConfigurablePolicies
- ExtlClntAppSampleSettings
- Form
- FormSection
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
- UserProfileSearchScope
- VisualizationPlugin
- WorkSkillRoutingAttribute
- XOrgHub
- AiEvaluationDefinition
- AnalyticsVisualization
- AnalyticsVizViewDef
