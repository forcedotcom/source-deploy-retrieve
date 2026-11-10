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
import { DEFAULT_PACKAGE_ROOT_SFDX, META_XML_SUFFIX } from '../../common/constants';
import { SourceComponent } from '../../resolve/sourceComponent';
import { WriteInfo } from '../types';
import { getReplacementStreamForReadable } from '../replacements';
import { BaseMetadataTransformer } from './baseMetadataTransformer';

/**
 * Transformer for ComputeApp components.
 *
 * Only the root xml goes through the Metadata API; the app source is uploaded and
 * downloaded by the Elastic Compute transport. So:
 * - to metadata: `computeApps/<name>/<name>.computeApp-meta.xml` => `computeApps/<name>.computeApp`
 * - to source: `computeApps/<name>.computeApp` => `main/default/computeApps/<name>/<name>.computeApp-meta.xml`
 */
export class ComputeAppMetadataTransformer extends BaseMetadataTransformer {
  // eslint-disable-next-line @typescript-eslint/require-await, class-methods-use-this
  public async toMetadataFormat(component: SourceComponent): Promise<WriteInfo[]> {
    if (!component.xml) return [];
    const { directoryName, suffix } = component.type;
    return [
      {
        source: getReplacementStreamForReadable(component, component.xml),
        output: join(directoryName, `${component.fullName}.${suffix ?? ''}`),
      },
    ];
  }

  // eslint-disable-next-line @typescript-eslint/require-await, class-methods-use-this
  public async toSourceFormat({
    component,
    mergeWith,
  }: {
    component: SourceComponent;
    mergeWith?: SourceComponent;
  }): Promise<WriteInfo[]> {
    if (!component.xml) return [];
    const { directoryName, suffix } = component.type;
    return [
      {
        source: getReplacementStreamForReadable(component, component.xml),
        output:
          mergeWith?.xml ??
          join(
            DEFAULT_PACKAGE_ROOT_SFDX,
            directoryName,
            component.fullName,
            `${component.fullName}.${suffix ?? ''}${META_XML_SUFFIX}`
          ),
      },
    ];
  }
}
