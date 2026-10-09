# Supported CLI Metadata Types

This list compares metadata types found in Salesforce v68 with the [metadata registry file](./src/registry/metadataRegistry.json) included in this repository.

This repository is used by both the Salesforce CLIs and Salesforce's VSCode Extensions.

Currently, there are 812/949 supported metadata types.
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
|AIWorksheetTemplate|❌|Not supported, but support could be added|
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
|AgentforcePlatformTracingSettings|✅||
|AgentforceProspectingSettings|✅||
|AgentforceSessionTracingSettings|✅||
|AgenticCtxtDecorDefinition|❌|Not supported, but support could be added|
|Ai4mSettings|✅||
|AiAgentDefinition|✅||
|AiAgentDefinitionPlanner|❌|Not supported, but support could be added|
|AiAgentDefinitionVersion|✅||
|AiAgentScorerDefinition|⚠️|Supports deploy/retrieve but not source tracking|
|AiAuthoringBundle|✅||
|AiEvaluationDefinition|⚠️|Supports deploy/retrieve but not source tracking|
|AiPlannerVoiceAvatarDef|❌|Not supported, but support could be added|
|AiPlannerVoiceDef|❌|Not supported, but support could be added (but not for tracking)|
|AiResponseFormat|⚠️|Supports deploy/retrieve but not source tracking|
|AiResponseFormatIstr|❌|Not supported, but support could be added (but not for tracking)|
|AiSurface|⚠️|Supports deploy/retrieve but not source tracking|
|AiSurfaceInput|❌|Not supported, but support could be added (but not for tracking)|
|AiSurfaceInstruction|❌|Not supported, but support could be added (but not for tracking)|
|AiTestingDefinition|⚠️|Supports deploy/retrieve but not source tracking|
|AnalyticSnapshot|✅||
|AnalyticsAgentDefinition|❌|Not supported, but support could be added (but not for tracking)|
|AnalyticsDashboard|✅||
|AnalyticsDatasetDefinition|❌|Not supported, but support could be added|
|AnalyticsLlmOverride|❌|Not supported, but support could be added (but not for tracking)|
|AnalyticsSettings|✅||
|AnalyticsVisualization|✅||
|AnalyticsWorkspace|✅||
|AnimationRule|✅||
|AnlytAgntFlbkSmntcModel|❌|Not supported, but support could be added (but not for tracking)|
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
|AppStudioSettings|✅||
|ApplicationRecordTypeConfig|✅||
|ApplicationSubtypeDefinition|✅||
|AppointmentAssignmentPolicy|✅||
|AppointmentBookingSettings|✅||
|AppointmentSchedulingPolicy|✅||
|ApprovalProcess|✅||
|ApptBookingConfig|❌|Not supported, but support could be added|
|ApptBookingUrlConfig|❌|Not supported, but support could be added|
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
|AutomationPipeline|❌|Not supported, but support could be added|
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
|BotEmailDefinition|❌|Not supported, but support could be added|
|BotSettings|✅||
|BotTemplate|✅||
|BotVersion|✅||
|BranchManagementSettings|✅||
|BrandKitSettings|✅||
|BrandingSet|✅||
|BriefcaseDefinition|✅||
|BusinessHoursSettings|✅||
|BusinessProcess|✅||
|BusinessProcessGroup|✅||
|BusinessProcessTypeDefinition|✅||
|BusinessValueMetricsSettings|✅||
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
|CnfgItemAttrDef|✅||
|CnfgItemAttrPcklstValDef|✅||
|CnfgItemAttrPicklistDef|✅||
|CnfgItemAttrSetAttr|✅||
|CnfgItemAttrSetDef|✅||
|CnfgItemSourceDefinition|✅||
|CnfgItemTypeAttrRelDef|✅||
|CnfgItemTypeDef|✅||
|CnfgItemTypeIdentFieldMap|✅||
|CnfgItemTypeIdentRule|✅||
|CnfgItemTypeRelationDef|✅||
|CnfgItmAstSyncRule|❌|Not supported, but support could be added (but not for tracking)|
|CnfgItmTypAttrSrcRcnRule|❌|Not supported, but support could be added|
|CnfgItmTypCmplCond|❌|Not supported, but support could be added|
|CnfgItmTypCmplCrit|❌|Not supported, but support could be added|
|CnfgItmTypDefCmplCrit|❌|Not supported, but support could be added|
|CnfgItmTypSrcRcnRule|❌|Not supported, but support could be added|
|CnfgMgmtAssetStsQual|❌|Not supported, but support could be added (but not for tracking)|
|CnfgMgmtDataBndl|❌|Not supported, but support could be added|
|CnfgMgmtItemFieldMap|❌|Not supported, but support could be added|
|CnfgMgmtItemValueMap|❌|Not supported, but support could be added|
|CnfgMgmtRcnRuleSugg|❌|Not supported, but support could be added|
|CnfgMgmtRelationTypeDef|✅||
|CnfgMgmtSvcMapLyot|❌|Not supported, but support could be added|
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
|ConsentTemplate|❌|Not supported, but support could be added|
|ConstraintOptDef|❌|Not supported, but support could be added|
|ContentAsset|✅||
|ContentSettings|✅||
|ContentTypeBundle|✅||
|ContentWorkspace|❌|Not supported, but support could be added|
|ContentWorkspacePermission|❌|Not supported, but support could be added|
|ContextDefinition|✅||
|ContextMappingConfig|❌|Not supported, but support could be added|
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
|CustomPreferencePageSettings|✅||
|CustomSite|✅||
|CustomTab|✅||
|CustomValue|❌|Not supported, but support could be added|
|CustomerDataPlatformSettings|✅||
|CustomizablePropensityScoringSettings|✅||
|DCOpportunityScoringSettings|✅||
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
|DataMaskPolicy|❌|Not supported, but support could be added|
|DataMaskSettings|✅||
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
|DebugLevel|❌|Not supported, but support could be added|
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
|DigitalWalletSettings|✅||
|DisclosureDefinition|✅||
|DisclosureDefinitionVersion|✅||
|DisclosureType|✅||
|DiscoSettings|✅||
|DiscoveryAIModel|✅||
|DiscoveryGoal|✅||
|DiscoverySettings|✅||
|DiscoveryStory|✅||
|DocProcDefinition|❌|Not supported, but support could be added|
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
|DsarPolicy|❌|Not supported, but support could be added|
|DuplicateRule|✅||
|DxGlobalTermsSettings|✅||
|DynamicFormsSettings|✅||
|DynamicFulfillmentOrchestratorSettings|✅||
|DynamicGanttSettings|✅||
|DynamicUiCardDefinition|✅||
|EACSettings|✅||
|ESignatureConfig|✅||
|ESignatureEnvelopeConfig|✅||
|EasyFreemiumSettings|✅||
|EasySuitesInvoicingSettings|✅||
|EclairGeoData|✅||
|EinsteinAISettings|✅||
|EinsteinAgentSettings|✅||
|EinsteinAssistantSettings|✅||
|EinsteinCopilotSettings|✅||
|EinsteinDealInsightsSettings|✅||
|EinsteinDocumentCaptureSettings|✅||
|EinsteinGPTSalesEmailsSettings|✅||
|EinsteinGptSettings|✅||
|EmailAdministrationSettings|✅||
|EmailAuthorizationSettings|✅||
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
|EnablementCompetencyDef|❌|Not supported, but support could be added|
|EnablementMeasureDefinition|✅||
|EnablementProgramDefinition|✅||
|EnblProgramTaskSubCategory|✅||
|EngmtChannelTypeConfig|❌|Not supported, but support could be added (but not for tracking)|
|EnhancedNotesSettings|✅||
|EnhancedServiceWFMSettings|✅||
|EnterpriseApiSettings|✅||
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
|ExternalAiAgentSetup|❌|Not supported, but support could be added|
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
|ExtlClntAppOauthSecuritySettings|✅||
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
|FinancialAppUiConfig|❌|Not supported, but support could be added|
|FinancialEvaluationDef|❌|Not supported, but support could be added|
|FinancialPortfolioUiConfig|❌|Not supported, but support could be added|
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
|GenAiPlugin|✅||
|GenAiPromptTemplate|✅||
|GenAiPromptTemplateActv|✅||
|GenComputingSummaryDef|❌|Not supported, but support could be added|
|GenOpAgentConfig|❌|Not supported, but support could be added|
|GenOpPlanEligibilityConfig|❌|Not supported, but support could be added|
|GeneralConfigSettings|✅||
|GenerativeCampaignsSettings|✅||
|GeocodeSettings|✅||
|GiftEntryGridTemplate|✅||
|GlobalValueSet|✅||
|GlobalValueSetTranslation|✅||
|GoogleAppsSettings|✅||
|Group|✅||
|HealthInsDataSyncDefn|❌|Not supported, but support could be added|
|HelpSettings|✅||
|HerokuAppLinkSettings|✅||
|HighVelocitySalesSettings|✅||
|HomePageComponent|✅||
|HomePageLayout|✅||
|HouseholdNamingConfig|✅||
|HouseholdUiConfiguration|❌|Not supported, but support could be added|
|IPAddressRange|✅||
|Icon|✅||
|IdeasSettings|✅||
|IdentityProviderSettings|✅||
|IdentityRsolDataSyncDef|❌|Not supported, but support could be added|
|IdentityVerificationProcDef|✅||
|IdpConfiguration|⚠️|Supports deploy/retrieve but not source tracking|
|IframeWhiteListUrlSettings|✅||
|InboundCertificate|✅||
|InboundNetworkConnection|✅||
|IncidentMgmtSettings|✅||
|IncludeEstTaxInQuoteCPQSettings|✅||
|IncludeEstTaxInQuoteSettings|✅||
|Index|⚠️|Supports deploy/retrieve but not source tracking|
|IndustriesAutomotiveSettings|✅||
|IndustriesChannelPartnerInventorySettings|✅||
|IndustriesCommunicationsSalesSettings|✅||
|IndustriesConnectedServiceSettings|✅||
|IndustriesConstraintsSettings|✅||
|IndustriesContextSettings|✅||
|IndustriesEinsteinFeatureSettings|✅||
|IndustriesEnergyUtilitiesMultiSiteSettings|✅||
|IndustriesEventOrchSettings|✅||
|IndustriesFieldServiceSettings|✅||
|IndustriesGamificationSettings|✅||
|IndustriesInsuranceSettings|✅||
|IndustriesLoyaltySettings|✅||
|IndustriesLsCommercialSettings|✅||
|IndustriesMaczPricingSettings|✅||
|IndustriesManufacturingSettings|✅||
|IndustriesMfgAdvnOrderSettings|✅||
|IndustriesMfgSampleManagementSettings|✅||
|IndustriesPricingSettings|✅||
|IndustriesRatingSettings|✅||
|IndustriesRepossessionSettings|✅||
|IndustriesSettings|✅||
|IndustriesUnifiedInventorySettings|✅||
|IndustriesUnifiedPromotionsSettings|✅||
|IndustriesUsageSettings|✅||
|InsBillingConfig|❌|Not supported, but support could be added|
|InsPlcyCoverageSpecConfig|❌|Not supported, but support could be added|
|InsPlcyLimitConsumptionRule|❌|Not supported, but support could be added|
|InsPlcyLineOfBusConfig|❌|Not supported, but support could be added|
|InsPolicyLifecycleConfig|❌|Not supported, but support could be added|
|InsPolicyManagementConfig|❌|Not supported, but support could be added|
|InsRatePlanCmsnConfig|❌|Not supported, but support could be added|
|InsRatePlanTypeConfig|❌|Not supported, but support could be added|
|InstalledPackage|⚠️|Supports deploy/retrieve but not source tracking|
|InsuranceBrokerageSettings|✅||
|InsuranceUnderwriterSettings|✅||
|IntegArtifactDef|✅||
|IntegratedPlanDefinition|❌|Not supported, but support could be added|
|IntegrationProcdDefinition|✅||
|IntegrationProviderDef|✅||
|InterestTaggingSettings|✅||
|InternalDataConnector|✅||
|InvLatePymntRiskCalcSettings|✅||
|InvMgmtForUnusableQtySettings|✅||
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
|LeadScoreSettings|✅||
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
|LightningOutApp|✅||
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
|MCETransformationsSettings|✅||
|MacroSettings|✅||
|MailAppOwaWhitelist|❌|Not supported, but support could be added|
|MailMergeSettings|✅||
|ManagedContentType|⚠️|Supports deploy/retrieve but not source tracking|
|ManagedEventSubscription|✅||
|ManagedTopics|✅||
|MapReportSettings|✅||
|MapsAndLocationSettings|✅||
|MarketSegmentDefinition|✅||
|MarketingAppExtActivity|❌|Not supported, but support could be added|
|MarketingAppExtension|✅||
|MarketingHierarchyGroupDef|❌|Not supported, but support could be added|
|MarketingHierarchyGroupNodeDef|❌|Not supported, but support could be added|
|MarketingHierarchyNodeDef|❌|Not supported, but support could be added|
|MatchingRules|✅||
|McpServerDefinition|✅||
|MediaAdSalesSettings|✅||
|MediaAgentSettings|✅||
|MeetingPlaybookDefinition|✅||
|MeetingsSettings|✅||
|MessagingChannel|⚠️|Supports deploy/retrieve but not source tracking|
|MessagingMobileAppChannel|❌|Not supported, but support could be added (but not for tracking)|
|MessagingMobileAppChannelButton|❌|Not supported, but support could be added (but not for tracking)|
|MessagingMobileAppChannelButtonSet|❌|Not supported, but support could be added (but not for tracking)|
|MfgProgramTemplate|✅||
|MfgServiceConsoleSettings|✅||
|MilestoneType|✅||
|MissionforceLogisticsSettings|✅||
|MissionforceSettings|✅||
|MktCalcInsightObjectDef|✅||
|MktDataConnection|✅||
|MktDataConnectionParam|❌|Not supported, but support could be added|
|MktDataConnectionSrcParam|✅||
|MktDataTranObject|✅||
|MktPlanningOpsSettings|✅||
|MlDomain|✅||
|MobSecurityCertPinConfig|✅||
|MobileAppNewsflashTopic|❌|Not supported, but support could be added (but not for tracking)|
|MobileApplicationDetail|✅||
|MobilePublisherAppConfig|❌|Not supported, but support could be added|
|MobilePublisherAppVersion|❌|Not supported, but support could be added|
|MobilePublisherDelegateDistributionAccount|❌|Not supported, but support could be added|
|MobilePublisherPrivateDistributionAccount|❌|Not supported, but support could be added|
|MobilePublisherProject|❌|Not supported, but support could be added|
|MobileSecurityAssignment|✅||
|MobileSecurityPolicy|✅||
|MobileSettings|✅||
|ModerationRule|✅||
|MsTeamsAppSettings|✅||
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
|PlanningDimensionDef|❌|Not supported, but support could be added|
|PlanningMeasureDef|❌|Not supported, but support could be added|
|PlanningMeasureGroup|❌|Not supported, but support could be added|
|PlatformCachePartition|✅||
|PlatformComputeApp|❌|Not supported, but support could be added|
|PlatformEventChannel|✅||
|PlatformEventChannelMember|✅||
|PlatformEventMigration|❌|Not supported, but support could be added|
|PlatformEventSettings|✅||
|PlatformEventSubscriberConfig|✅||
|PlatformSlackSettings|✅||
|PlatformWebIdeSettings|✅||
|PolicyRuleDefinition|✅||
|PolicyRuleDefinitionSet|✅||
|PortalDelegablePermissionSet|✅||
|PortalsSettings|✅||
|PostTemplate|✅||
|PredictionBuilderSettings|✅||
|PresenceDeclineReason|✅||
|PresenceUserConfig|✅||
|PricingActionParameters|✅||
|PricingRecipe|✅||
|PrivacyAgentSettings|✅||
|PrivacyOrgConfig|❌|Not supported, but support could be added|
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
|QualityManagementSettings|✅||
|Queue|✅||
|QueueRoutingConfig|✅||
|QuickAction|✅||
|QuickTextSettings|✅||
|QuoteSettings|✅||
|RealTimeEventSettings|✅||
|RebateAndAccrualMgmtAdvncdSettings|✅||
|RecAlrtDataSrcExpSetDef|✅||
|RecLifecyclCompanCpblDef|❌|Not supported, but support could be added|
|RecLifecyclCompanDef|❌|Not supported, but support could be added|
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
|ReferralIntakeConfiguration|✅||
|ReferralManagementSettings|✅||
|ReferralMarketingConfig|❌|Not supported, but support could be added|
|ReferralMarketingSettings|✅||
|RegisteredExternalService|✅||
|RelatedRecordAccessDef|❌|Not supported, but support could be added|
|RelatedRecordAssocCriteria|✅||
|RelationshipGraphDefinition|✅||
|ReleaseMgmtSettings|✅||
|RemoteSiteSetting|✅||
|ReplyEmailConfig|❌|Not supported, but support could be added (but not for tracking)|
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
|SalesBotsSettings|✅||
|SalesCloudSurfacesSettings|✅||
|SalesDealAgentSettings|✅||
|SalesEmailAssistantSettings|✅||
|SalesPlanDataSource|❌|Not supported, but support could be added|
|SalesWorkQueueSettings|✅||
|SamlSsoConfig|✅||
|SandboxSettings|✅||
|SceGlobalModelOptOutSettings|✅||
|SchedulingObjective|✅||
|SchedulingRecipeSettings|✅||
|SchedulingRule|✅||
|SchemaSettings|✅||
|ScndTelephPrvdOtbdDtl|❌|Not supported, but support could be added|
|ScopedAccess|❌|Not supported, but support could be added|
|ScoreCategory|✅||
|SearchCustomization|⚠️|Supports deploy/retrieve but not source tracking|
|SearchOrgWideObjectConfig|⚠️|Supports deploy/retrieve but not source tracking|
|SearchSettings|✅||
|SecondaryTelephonyProvider|❌|Not supported, but support could be added|
|SecurityAgentSettings|✅||
|SecurityCustomBaseline|❌|Not supported, but support could be added|
|SecurityHubSettings|✅||
|SecuritySettings|✅||
|SecuritySignalWorkspace|❌|Not supported, but support could be added (but not for tracking)|
|SelfSvcPortalTopic|❌|Not supported, but support could be added|
|SensitiveDataRuleElmntGrp|❌|Not supported, but support could be added|
|SequenceServiceSettings|✅||
|ServiceAIRecommendationsSettings|✅||
|ServiceAISetupDefinition|✅||
|ServiceAISetupField|✅||
|ServiceCatalogSettings|✅||
|ServiceChannel|✅||
|ServiceCloudNotificationOrchestratorSettings|✅||
|ServiceCloudVoiceSettings|✅||
|ServiceHamSettings|✅||
|ServiceHeliosSettings|✅||
|ServiceIssueManagementSettings|✅||
|ServiceItamSettings|✅||
|ServiceItomSettings|✅||
|ServiceItsmChangeManagementSettings|✅||
|ServiceItsmIntelligenceUddSettings|✅||
|ServiceLegalStatusesSettings|✅||
|ServiceMgmtKnwlgArtclConfig|❌|Not supported, but support could be added|
|ServiceMgmtKnwlgArtclConfigSettings|✅||
|ServicePresenceStatus|✅||
|ServiceProcess|✅||
|ServiceProcessSettings|✅||
|ServiceRepAssistantSettings|✅||
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
|SlackAppTemplate|❌|Not supported, but support could be added|
|SoFieldMappingSettings|✅||
|SocialCustomerServiceSettings|✅||
|SourceTrackingSettings|✅||
|SpiffSettings|✅||
|SrvcMgmtObjCollabAppCnfg|❌|Not supported, but support could be added|
|StageAssignment|✅||
|StageDefinition|✅||
|StandardValue|❌|Not supported, but support could be added|
|StandardValueSet|✅||
|StandardValueSetTranslation|✅||
|StaticResource|✅||
|StatisticalDealInsightsSettings|✅||
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
|TelemetryActionDefStep|✅||
|TelemetryActionDefinition|✅||
|TelemetryActnDefStepAttr|✅||
|TelemetryDefinition|✅||
|TelemetryDefinitionVersion|✅||
|TelephonyProvider|❌|Not supported, but support could be added|
|TenantSecurityPlaybookDef|❌|Not supported, but support could be added|
|TenantSecurityPlaybookDefStep|❌|Not supported, but support could be added|
|TenantSecurityPlaybookDefVer|❌|Not supported, but support could be added|
|TenantSecurityStepDef|❌|Not supported, but support could be added|
|TenantSecurityStepDefVer|❌|Not supported, but support could be added|
|Territory|✅||
|Territory2|✅||
|Territory2Model|✅||
|Territory2Rule|✅||
|Territory2Settings|✅||
|Territory2Type|✅||
|ThunderbirdVoiceSettings|✅||
|TimeSheetTemplate|✅||
|TimelineObjectDefinition|✅||
|TmfOutboundNotificationSettings|✅||
|TmshtLaborCostOptimAiSettings|✅||
|TopicsForObjects|✅||
|TrailheadSettings|✅||
|TransactableMarketplacePrivateOfferSettings|✅||
|TransactionProcessingType|⚠️|Supports deploy/retrieve but not source tracking|
|TransactionSecurityPolicy|✅||
|Translations|✅||
|TrialOrgSettings|✅||
|TriggerConfigurationsSettings|✅||
|TrustedTelephonyProvider|❌|Not supported, but support could be added|
|UIBundle|✅||
|UIBundleSettings|✅||
|UIObjectRelationConfig|✅||
|UiFormatSpecificationSet|✅||
|UiPlugin|✅||
|UiPreviewMessageTabDef|✅||
|UiWidgetBundle|⚠️|Supports deploy/retrieve but not source tracking|
|UiWidgetSettings|✅||
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
|VoiceWorkflowDefinition|❌|Not supported, but support could be added|
|VoiceWorkflowVersion|❌|Not supported, but support could be added (but not for tracking)|
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
|WinProbabilityScoringSetup|❌|Not supported, but support could be added|
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
|WorkforceSchedulingSettings|✅||



## Next Release (v69)

> **Note**
> v69 coverage not available at this time

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
- Form
- FormSection
- GenAiPlanner
- GenAiPlannerBundle
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
