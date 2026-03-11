# Supported CLI Metadata Types

This list compares metadata types found in Salesforce v66 with the [metadata registry file](./src/registry/metadataRegistry.json) included in this repository.

This repository is used by both the Salesforce CLIs and Salesforce's VSCode Extensions.

Currently, there are 0/0 supported metadata types.
For status on any existing gaps, please search or file an issue in the [Salesforce CLI issues only repo](https://github.com/forcedotcom/cli/issues).
To contribute a new metadata type, please see the [Contributing Metadata Types to the Registry](./contributing/metadata.md)

|Metadata Type|Support|Notes|
|:---|:---|:---|



## Next Release (v67)

v67 introduces the following new types.  Here's their current level of support

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
|AccountPlanObjMeasCalcDef|✅||
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
|AdminSuccessSettings|✅||
|AdvAccountForecastSet|✅||
|AdvAcctForecastDimSource|✅||
|AdvAcctForecastPeriodGroup|✅||
|AffinityScoreDefinition|✅||
|AgentPlatformSettings|✅||
|AgentforceAccountManagementSettings|✅||
|AgentforceForDevelopersSettings|✅||
|Ai4mSettings|✅||
|AiAuthoringBundle|✅||
|AiEvaluationDefinition|⚠️|Supports deploy/retrieve but not source tracking|
|AiPlannerVoiceDef|❌|Not supported, but support could be added (but not for tracking)|
|AiResponseFormat|❌|Not supported, but support could be added (but not for tracking)|
|AiResponseFormatIstr|❌|Not supported, but support could be added (but not for tracking)|
|AiSurface|❌|Not supported, but support could be added (but not for tracking)|
|AiSurfaceInstruction|❌|Not supported, but support could be added (but not for tracking)|
|AnalyticSnapshot|✅||
|AnalyticsDashboard|✅||
|AnalyticsDatasetDefinition|❌|Not supported, but support could be added|
|AnalyticsSettings|✅||
|AnalyticsVisualization|✅||
|AnalyticsWorkspace|✅||
|AnimationRule|✅||
|ApexClass|✅||
|ApexComponent|✅||
|ApexEmailNotifications|✅||
|ApexLimitSettings|✅||
|ApexPage|✅||
|ApexSettings|✅||
|ApexTestSuite|✅||
|ApexTrigger|✅||
|ApiNamedQuery|✅||
|AppAnalyticsSettings|✅||
|AppExperienceSettings|✅||
|AppFrameworkTemplateBundle|✅||
|AppMenu|✅||
|ApplicationRecordTypeConfig|✅||
|ApplicationSubtypeDefinition|✅||
|AppointmentAssignmentPolicy|✅||
|AppointmentBookingSettings|✅||
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
|AutomatorConfigSettings|✅||
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
|CatalogedApi|✅||
|CatalogedApiArtifactVersionInfo|✅||
|CatalogedApiVersion|✅||
|Certificate|✅||
|ChannelLayout|✅||
|ChannelObjectLinkingRule|✅||
|ChannelRevMgmtSettings|✅||
|ChatterAnswersSettings|✅||
|ChatterEmailsMDSettings|✅||
|ChatterExtension|✅||
|ChatterSettings|✅||
|ChoiceList|⚠️|Supports deploy/retrieve but not source tracking|
|ClaimCoverageProdtProcDef|❌|Not supported, but support could be added|
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
|CommunicationChannelLine|❌|Not supported, but support could be added|
|CommunicationChannelType|❌|Not supported, but support could be added|
|CommunitiesSettings|✅||
|Community|✅||
|CommunityTemplateDefinition|✅||
|CommunityThemeDefinition|✅||
|CompactLayout|✅||
|CompanySettings|✅||
|ComputeExtension|✅||
|ConnectedApp|✅||
|ConnectedAppSettings|✅||
|ContentAsset|✅||
|ContentSettings|✅||
|ContentTypeBundle|✅||
|ContextDefinition|✅||
|ContextMappingConfig|❌|Not supported, but support could be added|
|ContextUseCaseMapping|✅||
|ContractSettings|✅||
|ContractType|✅||
|ConvIntelligenceSignalRule|✅||
|ConversationChannelDefinition|✅||
|ConversationGuidanceSettings|✅||
|ConversationMessageDefinition|✅||
|ConversationServiceIntegrationSettings|✅||
|ConversationVendorInfo|✅||
|ConversationalIntelligenceSettings|✅||
|CorsWhitelistOrigin|✅||
|CourseWaitlistConfig|❌|Not supported, but support could be added|
|CriteriaSettings|✅||
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
|CustomObjectBinding|❌|Not supported, but support could be added|
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
|DataCleanRoomProvider|❌|Not supported, but support could be added|
|DataConnector|✅||
|DataConnectorIngestApi|✅||
|DataConnectorS3|✅||
|DataDotComSettings|✅||
|DataImportManagementSettings|✅||
|DataKitObjectDependency|✅||
|DataKitObjectTemplate|✅||
|DataMapperDefinition|✅||
|DataObjectBuildOrgTemplate|✅||
|DataObjectSearchIndexConf|⚠️|Supports deploy/retrieve but not source tracking|
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
|DealInsightsSettings|✅||
|DecisionMatrixDefinition|✅||
|DecisionMatrixDefinitionVersion|✅||
|DecisionTable|✅||
|DecisionTableDatasetLink|✅||
|DelegateAccessDataSet|❌|Not supported, but support could be added|
|DelegateAccessDef|❌|Not supported, but support could be added|
|DelegateAccsDataSetObj|❌|Not supported, but support could be added|
|DelegateGroup|✅||
|DeploymentSettings|✅||
|DevHubSettings|✅||
|DgtAssetMgmtProvider|✅||
|DgtAssetMgmtPrvdLghtCpnt|✅||
|DictionariesSettings|✅||
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
|DocumentExtractionDef|❌|Not supported, but support could be added|
|DocumentFolder|✅||
|DocumentGenerationSetting|✅||
|DocumentTemplate|⚠️|Supports deploy/retrieve but not source tracking|
|DocumentType|✅||
|DripFeedConfigSettings|✅||
|DuplicateRule|✅||
|DxGlobalTermsSettings|✅||
|DynamicFormsSettings|✅||
|DynamicFulfillmentOrchestratorSettings|✅||
|DynamicGanttSettings|✅||
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
|EmergencySettings|✅||
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
|EvidenceMgmtSettings|✅||
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
|ExternalStoragePrvdConfig|✅||
|ExtlClntAppAttestConfigurablePolicies|❌|Not supported, but support could be added (but not for tracking)|
|ExtlClntAppAttestSettings|✅||
|ExtlClntAppCanvasSettings|✅||
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
|FieldMappingConfig|✅||
|FieldRestrictionRule|✅||
|FieldServiceMobileConfig|✅||
|FieldServiceMobileExtension|✅||
|FieldServiceSettings|✅||
|FieldSet|✅||
|FieldSrcTrgtRelationship|✅||
|FileUploadAndDownloadSecuritySettings|✅||
|FilesConnectSettings|✅||
|FlexcardDefinition|✅||
|FlexiPage|✅||
|Flow|✅||
|FlowCategory|✅||
|FlowDefinition|⚠️|Supports deploy/retrieve but not source tracking|
|FlowSettings|✅||
|FlowTest|✅||
|FlowValueMap|✅||
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
|GRCIntelligenceUddSettings|✅||
|GatewayProviderPaymentMethodType|✅||
|GenAiFunction|✅||
|GenAiPlannerBundle|✅||
|GenAiPlugin|✅||
|GenAiPromptTemplate|✅||
|GenAiPromptTemplateActv|✅||
|GenComputingSummaryDef|❌|Not supported, but support could be added|
|GenOpPlanEligibilityConfig|❌|Not supported, but support could be added|
|GeneralConfigSettings|✅||
|GeocodeSettings|✅||
|GiftEntryGridTemplate|✅||
|GlobalValueSet|✅||
|GlobalValueSetTranslation|✅||
|GoogleAppsSettings|✅||
|Group|✅||
|HerokuAppLinkSettings|✅||
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
|IndustriesConnectedServiceSettings|✅||
|IndustriesConstraintsSettings|✅||
|IndustriesContextSettings|✅||
|IndustriesEinsteinFeatureSettings|✅||
|IndustriesEnergyUtilitiesMultiSiteSettings|✅||
|IndustriesEventOrchSettings|✅||
|IndustriesFieldServiceSettings|✅||
|IndustriesGamificationSettings|✅||
|IndustriesLoyaltySettings|✅||
|IndustriesLsCommercialSettings|✅||
|IndustriesManufacturingSettings|✅||
|IndustriesMfgSampleManagementSettings|✅||
|IndustriesPricingSettings|✅||
|IndustriesRatingSettings|✅||
|IndustriesSettings|✅||
|IndustriesUnifiedInventorySettings|✅||
|IndustriesUnifiedPromotionsSettings|✅||
|IndustriesUsageSettings|✅||
|IndustriesVectorSearchSettings|✅||
|InsPlcyCoverageSpecConfig|❌|Not supported, but support could be added|
|InsPlcyLineOfBusConfig|❌|Not supported, but support could be added|
|InsPolicyLifecycleConfig|❌|Not supported, but support could be added|
|InsPolicyManagementConfig|❌|Not supported, but support could be added|
|InsRatePlanCmsnConfig|❌|Not supported, but support could be added|
|InsRatePlanTypeConfig|❌|Not supported, but support could be added|
|InstalledPackage|⚠️|Supports deploy/retrieve but not source tracking|
|InsuranceBrokerageSettings|✅||
|IntegArtifactDef|✅||
|IntegratedPlanDefinition|❌|Not supported, but support could be added|
|IntegrationProcdDefinition|✅||
|IntegrationProviderDef|✅||
|InterestTaggingSettings|✅||
|InternalDataConnector|✅||
|InvLatePymntRiskCalcSettings|✅||
|InventoryAllocationSettings|✅||
|InventoryReplenishmentSettings|✅||
|InventorySettings|✅||
|InvocableActionExtension|✅||
|InvocableActionSettings|✅||
|IoTSettings|✅||
|KeywordList|✅||
|KnowledgeGenerationSettings|✅||
|KnowledgeSettings|✅||
|LaborCostOptimCrewMgmtSettings|✅||
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
|LifeSciConfigCategory|✅||
|LifeSciConfigRecord|✅||
|LightningBolt|✅||
|LightningComponentBundle|✅||
|LightningExperienceSettings|✅||
|LightningExperienceTheme|✅||
|LightningMessageChannel|✅||
|LightningOnboardingConfig|✅||
|LightningTypeBundle|✅||
|ListView|✅||
|LiveAgentSettings|✅||
|LiveChatAgentConfig|✅||
|LiveChatButton|✅||
|LiveChatDeployment|✅||
|LiveChatSensitiveDataRule|✅||
|LiveMessageSettings|✅||
|LocationUse|✅||
|LogicSettings|✅||
|LoyaltyProgramSetup|⚠️|Supports deploy/retrieve but not source tracking|
|MacroSettings|✅||
|MailMergeSettings|✅||
|ManagedContentType|⚠️|Supports deploy/retrieve but not source tracking|
|ManagedEventSubscription|✅||
|ManagedTopics|✅||
|MapReportSettings|✅||
|MapsAndLocationSettings|✅||
|MarketSegmentDefinition|✅||
|MarketingAppExtActivity|❌|Not supported, but support could be added|
|MarketingAppExtension|✅||
|MatchingRules|✅||
|McpServerDefinition|✅||
|MediaAdSalesSettings|✅||
|MediaAgentSettings|✅||
|MeetingPlaybookDefinition|❌|Not supported, but support could be added|
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
|ObjIntegProviderDefMapping|✅||
|ObjectHierarchyRelationship|✅||
|ObjectLinkingSettings|✅||
|ObjectMappingSettings|✅||
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
|OmniscriptDefinition|✅||
|OnboardingDataObjectGroup|✅||
|OnlineSalesSettings|✅||
|OpportunityScoreSettings|✅||
|OpportunitySettings|✅||
|OptimizationSettings|✅||
|OrchestrationPlanCtxMapping|❌|Not supported, but support could be added|
|OrderManagementSettings|✅||
|OrderSettings|✅||
|OrgSettings|✅||
|OutboundNetworkConnection|✅||
|PardotEinsteinSettings|✅||
|PardotSettings|✅||
|ParticipantRole|✅||
|PartyDataModelSettings|✅||
|PartyProfileDataObjectValidityDefinition|✅||
|PathAssistant|✅||
|PathAssistantSettings|✅||
|PaymentGatewayProvider|✅||
|PaymentsManagementEnabledSettings|✅||
|PaymentsSettings|✅||
|PaymentsSharingSettings|✅||
|PaynowStarterUpgradeEnabledSettings|✅||
|PermissionSet|✅||
|PermissionSetGroup|✅||
|PermissionSetLicenseDefinition|✅||
|PersonAccountOwnerPowerUser|✅||
|PicklistSettings|✅||
|PicklistValue|❌|Not supported, but support could be added|
|PipelineInspMetricConfig|✅||
|PlanningMeasureDef|❌|Not supported, but support could be added|
|PlanningMeasureGroup|❌|Not supported, but support could be added|
|PlatformCachePartition|✅||
|PlatformEventChannel|✅||
|PlatformEventChannelMember|✅||
|PlatformEventMigration|❌|Not supported, but support could be added|
|PlatformEventSettings|✅||
|PlatformEventSubscriberConfig|✅||
|PlatformSlackSettings|✅||
|PlatformWebIdeSettings|✅||
|PolicyRuleDefinition|❌|Not supported, but support could be added|
|PolicyRuleDefinitionSet|❌|Not supported, but support could be added|
|PortalDelegablePermissionSet|✅||
|PortalsSettings|✅||
|PostTemplate|✅||
|PredictionBuilderSettings|✅||
|PresenceDeclineReason|✅||
|PresenceUserConfig|✅||
|PricingActionParameters|✅||
|PricingRecipe|✅||
|PrivacySettings|✅||
|PrmCoreSettings|✅||
|ProcedureOutputResolution|❌|Not supported, but support could be added (but not for tracking)|
|ProcedurePlanDefinition|⚠️|Supports deploy/retrieve but not source tracking|
|ProcessFlowMigration|✅||
|ProductAttrDisplayConfig|✅||
|ProductAttributeSet|✅||
|ProductCatalogManagementSettings|✅||
|ProductConfiguratorSettings|✅||
|ProductDiscoverySettings|✅||
|ProductSettings|✅||
|ProductSpecificationRecType|✅||
|ProductSpecificationType|✅||
|Profile|✅||
|ProfilePasswordPolicy|✅||
|ProfileSessionSetting|✅||
|Prompt|✅||
|ProviderSampleLimitTemplate|❌|Not supported, but support could be added|
|PublicKeyCertificate|⚠️|Supports deploy/retrieve but not source tracking|
|PublicKeyCertificateSet|⚠️|Supports deploy/retrieve but not source tracking|
|PurchaseOrderMgmtSettings|✅||
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
|ReferralMarketingConfig|❌|Not supported, but support could be added|
|ReferralMarketingSettings|✅||
|RegisteredExternalService|✅||
|RelatedRecordAccessDef|❌|Not supported, but support could be added|
|RelatedRecordAssocCriteria|✅||
|RelationshipGraphDefinition|✅||
|ReleaseMgmtSettings|✅||
|RemoteSiteSetting|✅||
|Report|✅||
|ReportFolder|✅||
|ReportType|✅||
|RestrictionRule|✅||
|RetailExecutionSettings|✅||
|RetrievalSummaryDefinition|✅||
|RevenueManagementSettings|✅||
|RiskMgmtSettings|✅||
|Role|✅||
|SalesAgreementSettings|✅||
|SalesDealAgentSettings|✅||
|SalesWorkQueueSettings|✅||
|SamlSsoConfig|✅||
|SandboxSettings|✅||
|SceGlobalModelOptOutSettings|✅||
|SchedulingObjective|✅||
|SchedulingRecipeSettings|✅||
|SchedulingRule|✅||
|SchemaSettings|✅||
|ScoreCategory|✅||
|SearchCustomization|⚠️|Supports deploy/retrieve but not source tracking|
|SearchOrgWideObjectConfig|⚠️|Supports deploy/retrieve but not source tracking|
|SearchSettings|✅||
|SecurityAgentSettings|✅||
|SecurityHubSettings|✅||
|SecuritySettings|✅||
|SelfSvcPortalTopic|❌|Not supported, but support could be added|
|SequenceServiceSettings|✅||
|ServiceAIRecommendationsSettings|✅||
|ServiceAISetupDefinition|✅||
|ServiceAISetupField|✅||
|ServiceChannel|✅||
|ServiceCloudNotificationOrchestratorSettings|✅||
|ServiceCloudVoiceSettings|✅||
|ServiceIssueManagementSettings|✅||
|ServiceItsmChangeManagementSettings|✅||
|ServiceItsmIntelligenceUddSettings|✅||
|ServiceLegalStatusesSettings|✅||
|ServiceMgmtKnwlgArtclConfig|❌|Not supported, but support could be added|
|ServiceMgmtKnwlgArtclConfigSettings|✅||
|ServicePresenceStatus|✅||
|ServiceProcess|✅||
|ServiceProcessSettings|✅||
|ServiceScheduleConfig|❌|Not supported, but support could be added|
|ServiceSetupAssistantSettings|✅||
|SetupCopilotSettings|✅||
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
|SoFieldMappingSettings|✅||
|SocialCustomerServiceSettings|✅||
|SourceTrackingSettings|✅||
|SrvcMgmtObjCollabAppCnfg|❌|Not supported, but support could be added|
|StageAssignment|✅||
|StageDefinition|✅||
|StandardValue|❌|Not supported, but support could be added|
|StandardValueSet|✅||
|StandardValueSetTranslation|✅||
|StaticResource|✅||
|StnryAssetEnvSrcCnfg|✅||
|StockRotationSettings|✅||
|StreamingAppDataConnector|✅||
|SubscriptionManagementSettings|✅||
|SurveySettings|✅||
|SurveyStyleSet|❌|Not supported, but support could be added|
|SustainabilityUom|✅||
|SustnUomConversion|✅||
|SvcCatalogCategory|✅||
|SvcCatalogFilterCriteria|✅||
|SvcCatalogFulfillmentFlow|✅||
|SvcCatalogItemDef|✅||
|SynchronizeSettings|✅||
|SynonymDictionary|✅||
|SystemNotificationSettings|✅||
|Tag|❌|Not supported, but support could be added (but not for tracking)|
|TagSet|❌|Not supported, but support could be added (but not for tracking)|
|Territory|✅||
|Territory2|✅||
|Territory2Model|✅||
|Territory2Rule|✅||
|Territory2Settings|✅||
|Territory2Type|✅||
|TimeSheetTemplate|✅||
|TimelineObjectDefinition|✅||
|TmfOutboundNotificationSettings|✅||
|TmshtLaborCostOptimAiSettings|✅||
|TopicsForObjects|✅||
|TrailheadSettings|✅||
|TransactionProcessingType|⚠️|Supports deploy/retrieve but not source tracking|
|TransactionSecurityPolicy|✅||
|Translations|✅||
|TrialOrgSettings|✅||
|TriggerConfigurationsSettings|✅||
|UIObjectRelationConfig|✅||
|UiFormatSpecificationSet|✅||
|UiPlugin|✅||
|UiPreviewMessageTabDef|✅||
|UnifiedSalesIntelligenceEngagementInsightsSettings|✅||
|UnifiedSalesIntelligenceSettings|✅||
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
|VoiceEngagementMediaFile|❌|Not supported, but support could be added|
|VoiceEngagementMediaUsage|❌|Not supported, but support could be added|
|VoiceEngmtMediaFileAsgnt|❌|Not supported, but support could be added|
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
|WebApplication|✅||
|WebApplicationSettings|✅||
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
|WorkflowKnowledgePublish|✅||
|WorkflowOutboundMessage|✅||
|WorkflowRule|✅||
|WorkflowSend|✅||
|WorkflowTask|✅||
|WorkforceEngagementSettings|✅||

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
- MktDatalakeSrcKeyQualifier
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
- FieldMappingConfigItem
- Form
- FormSection
- GenAiPlanner
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
- WorkflowFlowAutomation
- WorkSkillRoutingAttribute
- XOrgHub
- RuleLibraryDefinition
- LightningOutApp
