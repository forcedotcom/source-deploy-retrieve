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
import * as standardValueSetData from './stdValueSetRegistry.json';

/**
 * StandardValueSet metadata reference data.
 *
 * Contains a list of all supported StandardValueSet full names (e.g., `AccountContactMultiRoles`, `AccountOwnership`)
 * that can be queried from Salesforce orgs. Useful for working with StandardValueSet metadata via the Metadata API.
 *
 * The static import of json file should never be changed,
 * other read methods might make esbuild fail to bundle the json file.
 */
export const standardValueSet = standardValueSetData as Readonly<typeof standardValueSetData>;
