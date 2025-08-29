/*
 * Copyright 2025, Salesforce, Inc.
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
import { expect } from 'chai';
import { ComponentSet } from '../../../src/collections/componentSet';
import { RegistryAccess } from '../../../src/registry/registryAccess';
import { getEffectiveRegistry } from '../../../src/registry/variants';
import { presetMap } from '../../../src/registry/presets/presetMap';
import { DecomposedPermissionSetTransformer } from '../../../src/convert/transformers/decomposedPermissionSetTransformer';
import {
  MD_FORMAT_PS,
  MD_FORMAT_PS_ONE_CHILD,
  ONLY_PS_PARENT,
  SOURCE_FORMAT_PS,
} from '../../mock/type-constants/decomposedPermissionSetConstant';

describe('DecomposedPermissionSetTransformer', () => {
  const regAcc = new RegistryAccess(getEffectiveRegistry({ presets: [presetMap.get('decomposePermissionSetBeta2')!] }));

  describe('toSourceFormat', () => {
    describe('WriteInfo output (where the file will write to)', () => {
      it('multiple children combined, and some written to individual files', async () => {
        const component = MD_FORMAT_PS;
        const xf = new DecomposedPermissionSetTransformer(regAcc);
        const result = await xf.toSourceFormat({ component });
        expect(result).to.have.length(8);
        result.map((l) => {
          expect(l.output).to.include(join('main', 'default', 'permissionsets'));
        });
        expect(result[0].output).to.match(/myPS.classAccess-meta.xml$/);
        expect(result[1].output).to.match(/myPS.userPermission-meta.xml$/);
        expect(result[2].output).to.match(/objectSettings[\\/]Account.objectSettings-meta.xml$/);
        expect(result[3].output).to.match(/objectSettings[\\/]AppAnalyticsQueryRequest.objectSettings-meta.xml$/);
        expect(result[4].output).to.match(/objectSettings[\\/]Asset.objectSettings-meta.xml$/);
        expect(result[5].output).to.match(/objectSettings[\\/]AssetAction.objectSettings-meta.xml$/);
        expect(result[6].output).to.match(/objectSettings[\\/]Broker__c.objectSettings-meta.xml$/);
        expect(result[7].output).to.match(/myPS.permissionset-meta.xml$/);
      });

      it('will write a singular child type', async () => {
        const component = MD_FORMAT_PS_ONE_CHILD;
        const xf = new DecomposedPermissionSetTransformer(regAcc);
        const result = await xf.toSourceFormat({ component });
        expect(result).to.have.length(2);
        result.map((l) => {
          expect(l.output).to.include(join('main', 'default', 'permissionsets'));
        });
        expect(result[0].output).to.match(/objectSettings[\\/]Case.objectSettings-meta.xml$/);
        expect(result[1].output).to.match(/myPS.permissionset-meta.xml$/);
      });

      it('merge component in defaultDir', async () => {
        const component = MD_FORMAT_PS;
        const xf = new DecomposedPermissionSetTransformer(regAcc);
        const result = await xf.toSourceFormat({
          component,
          mergeSet: new ComponentSet([ONLY_PS_PARENT], regAcc),
        });
        expect(result).to.have.length(8);
        expect(result[7].output).to.equal(ONLY_PS_PARENT.xml!);
      });
    });
  });

  describe('toMetadataFormat', () => {
    it('decomposed PS 2 combined to md-format', async () => {
      const component = SOURCE_FORMAT_PS;
      const xf = new DecomposedPermissionSetTransformer(regAcc);
      const result = await xf.toMetadataFormat(component);
      expect(result).to.deep.equal([]);
      expect(xf.context.decomposedPermissionSet.permissionSetType).to.equal(regAcc.getTypeByName('PermissionSet'));
    });
  });
});
