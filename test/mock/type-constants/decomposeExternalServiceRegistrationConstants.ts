/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { join } from 'node:path';
import { SourceComponent, VirtualTreeContainer, presetMap, RegistryAccess } from '../../../src';
import { getEffectiveRegistry } from '../../../src/registry/variants';

// Constants for a matching content file type
const regAcc = new RegistryAccess(getEffectiveRegistry({ presets: [presetMap.get('decomposePermissionSetBeta2')!] }));

const externalServiceRegistration = regAcc.getTypeByName('ExternalServiceRegistration');

const MDAPI_XML_NAME = 'myESR.externalServiceRegistration';
const SOURCE_XML_NAME = 'myESR.externalServiceRegistration-meta.xml';

export const MD_FORMAT_ESR = new SourceComponent(
  {
    name: 'myESR',
    type: externalServiceRegistration,
    xml: join('externalServiceRegistrations', MDAPI_XML_NAME),
  },
  new VirtualTreeContainer([
    {
      dirPath: 'externalServiceRegistrations',
      children: [
        {
          name: MDAPI_XML_NAME,
          data: Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<ExternalServiceRegistration xmlns="http://soap.sforce.com/2006/04/metadata">
    <description>external service</description>
    <label>OpenAPIChallenge</label>
    <namedCredentialReference>ncred</namedCredentialReference>
    <registrationProviderType>Custom</registrationProviderType>
    <schema>openapi: 3.0.0
info:
  title: OpenAPIChallenge
  description: Now is the time for Apex OpenAPI
  version: 63.1.0
paths:
  /getAccountSummaryWithOpportunities:
    operations:
      get:
        summary: need to figure out what this means
        description: need to figure out what this means
        operationId: getAccountSummaryWithOpportunities
        responses: {}
  /getActiveCases:
    operations:
      get:
        summary: need to figure out what this means
        description: need to figure out what this means
        operationId: getActiveCases
        responses: {}
  /getAllAccounts:
    operations:
      get:
        summary: need to figure out what this means
        description: need to figure out what this means
        operationId: getAllAccounts
        responses: {}
  /getUserDetails:
    operations:
      get:
        summary: need to figure out what this means
        description: need to figure out what this means
        operationId: getUserDetails
        responses: {}
  /updateContactDetails:
    operations:
      get:
        summary: need to figure out what this means
        description: need to figure out what this means
        operationId: updateContactDetails
        responses: {}
  /getWelcomeMessage:
    operations:
      get:
        summary: need to figure out what this means
        description: need to figure out what this means
        operationId: getWelcomeMessage
        responses: {}
</schema>
    <schemaType>OpenApi3</schemaType>
    <schemaUploadFileExtension>yaml</schemaUploadFileExtension>
    <schemaUploadFileName>OpenAPIChallenge</schemaUploadFileName>
    <serviceBinding>{&quot;host&quot;:&quot;&quot;,&quot;basePath&quot;:&quot;/&quot;,&quot;allowedSchemes&quot;:[],&quot;requestMediaTypes&quot;:[],&quot;responseMediaTypes&quot;:[],&quot;compatibleMediaTypes&quot;:{}}</serviceBinding>
    <status>Complete</status>
    <systemVersion>5</systemVersion>
</ExternalServiceRegistration>

`),
        },
      ],
    },
  ])
);

export const SOURCE_FORMAT_ESR = new SourceComponent(
  {
    name: 'myESR',
    type: externalServiceRegistration,
    content: join('main', 'default', 'externalServiceRegistrations', 'myESR', SOURCE_XML_NAME),
  },
  new VirtualTreeContainer([
    {
      dirPath: join('main', 'default', 'externalServiceRegistrations', 'myESR'),
      children: [
        {
          name: 'myESR.externalServiceRegistrations-meta.xml',
          data: Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<ExternalServiceRegistration xmlns="http://soap.sforce.com/2006/04/metadata">
    <description>external service</description>
    <label>OpenAPIChallenge</label>
    <namedCredentialReference>ncred</namedCredentialReference>
    <registrationProviderType>Custom</registrationProviderType>
    <schemaType>OpenApi3</schemaType>
    <schemaUploadFileExtension>yaml</schemaUploadFileExtension>
    <schemaUploadFileName>OpenAPIChallenge</schemaUploadFileName>
    <serviceBinding>{&quot;host&quot;:&quot;&quot;,&quot;basePath&quot;:&quot;/&quot;,&quot;allowedSchemes&quot;:[],&quot;requestMediaTypes&quot;:[],&quot;responseMediaTypes&quot;:[],&quot;compatibleMediaTypes&quot;:{}}</serviceBinding>
    <status>Complete</status>
    <systemVersion>5</systemVersion>
</ExternalServiceRegistration>

`),
        },
        {
          name: 'myESR.schema.yaml',
          data: Buffer.from(`openapi: 3.0.0
info:
  title: OpenAPIChallenge
  description: Now is the time for Apex OpenAPI
  version: 63.1.0
paths:
  /getAccountSummaryWithOpportunities:
    operations:
      get:
        summary: need to figure out what this means
        description: need to figure out what this means
        operationId: getAccountSummaryWithOpportunities
        responses: {}
  /getActiveCases:
    operations:
      get:
        summary: need to figure out what this means
        description: need to figure out what this means
        operationId: getActiveCases
        responses: {}
  /getAllAccounts:
    operations:
      get:
        summary: need to figure out what this means
        description: need to figure out what this means
        operationId: getAllAccounts
        responses: {}
  /getUserDetails:
    operations:
      get:
        summary: need to figure out what this means
        description: need to figure out what this means
        operationId: getUserDetails
        responses: {}
  /updateContactDetails:
    operations:
      get:
        summary: need to figure out what this means
        description: need to figure out what this means
        operationId: updateContactDetails
        responses: {}
  /getWelcomeMessage:
    operations:
      get:
        summary: need to figure out what this means
        description: need to figure out what this means
        operationId: getWelcomeMessage
        responses: {}
`),
        },
      ],
    },
  ])
);
