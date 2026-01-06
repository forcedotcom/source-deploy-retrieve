/*
 * Copyright 2026, Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { join } from 'node:path';
import { SourceComponent, VirtualTreeContainer, presetMap, RegistryAccess } from '../../../src';
import { getEffectiveRegistry } from '../../../src/registry/variants';

// Constants for a matching content file type
const regAcc = new RegistryAccess(getEffectiveRegistry({ presets: [presetMap.get('decomposePermissionSetBeta2')!] }));

const externalServiceRegistration = regAcc.getTypeByName('ExternalServiceRegistration');

export const MDAPI_XML = 'myESR.externalServiceRegistration';
export const SOURCE_META_FILE = 'myESR.externalServiceRegistration-meta.xml';
export const CHILD_YAML = 'myESR.yaml';

export const TYPE_DIRECTORY = 'externalServiceRegistrations';

export const SAMPLE_OAS_DOC = `openapi: 3.0.0
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
`;

export const MD_FORMAT_ESR = new SourceComponent(
  {
    name: 'myESR',
    type: externalServiceRegistration,
    xml: join('externalServiceRegistrations', MDAPI_XML),
  },
  new VirtualTreeContainer([
    {
      dirPath: 'externalServiceRegistrations',
      children: [
        {
          name: MDAPI_XML,
          data: Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<ExternalServiceRegistration xmlns="http://soap.sforce.com/2006/04/metadata">
    <description>external service</description>
    <label>OpenAPIChallenge</label>
    <namedCredentialReference>ncred</namedCredentialReference>
    <registrationProviderType>Custom</registrationProviderType>
    <schema>${SAMPLE_OAS_DOC}
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
    xml: join('main', 'default', 'externalServiceRegistrations', SOURCE_META_FILE),
  },
  new VirtualTreeContainer([
    {
      dirPath: join('externalServiceRegistrations'),
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
          name: 'myESR.yaml',
          data: Buffer.from(SAMPLE_OAS_DOC),
        },
      ],
    },
  ])
);
