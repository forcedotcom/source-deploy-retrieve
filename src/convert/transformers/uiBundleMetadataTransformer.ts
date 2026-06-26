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
import { SourceComponent } from '../../resolve/sourceComponent';
import { validateUiBundleForDeploy } from '../../resolve/adapters/uiBundleValidation';
import { WriteInfo } from '../types';
import { DefaultMetadataTransformer } from './defaultMetadataTransformer';

/**
 * Transformer for UIBundle components.
 *
 * Behaves like the default transformer, but validates the bundle's ui-bundle.json descriptor
 * when converting to metadata format for deploy. Retrieve (toSourceFormat) skips validation.
 */
export class UiBundleMetadataTransformer extends DefaultMetadataTransformer {
  public async toMetadataFormat(component: SourceComponent): Promise<WriteInfo[]> {
    if (component.content) {
      validateUiBundleForDeploy(component.content, component.tree, component.getForceIgnore());
    }
    return super.toMetadataFormat(component);
  }
}
