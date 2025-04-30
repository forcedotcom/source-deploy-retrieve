/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
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
