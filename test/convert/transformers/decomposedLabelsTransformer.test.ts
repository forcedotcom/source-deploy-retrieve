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
import {
  EMPTY_CUSTOM_LABELS_CMP,
  ONE_CUSTOM_LABELS_CMP,
  ONLY_LABEL_CMP_IN_ANOTHER_DIR_CMP,
  ONLY_LABEL_CMP_IN_DEFAULT_DIR_CMP,
  ONLY_LABEL_NO_DIR_CMP,
  THREE_CUSTOM_LABELS_CMP,
} from '../../mock/type-constants/decomposedCustomLabelsConstant';
import {
  LabelMetadataTransformer,
  LabelsMetadataTransformer,
} from '../../../src/convert/transformers/decomposeLabelsTransformer';
import { getEffectiveRegistry } from '../../../src/registry/variants';
import { presetMap } from '../../../src/registry/presets/presetMap';

describe('DecomposedCustomLabelTransformer', () => {
  const regAcc = new RegistryAccess(getEffectiveRegistry({ presets: [presetMap.get('decomposeCustomLabelsBeta')!] }));

  describe('LabelsMetadataTransformer', () => {
    describe('toSourceFormat', () => {
      describe('WriteInfo output (where the file will write to)', () => {
        describe('default dir', () => {
          it('multiple labels in a single customLabels', async () => {
            const component = THREE_CUSTOM_LABELS_CMP;
            const xf = new LabelsMetadataTransformer(regAcc);
            const result = await xf.toSourceFormat({ component });
            expect(result).to.have.length(3);
            result.map((l) => {
              expect(l.output).to.include(join('main', 'default', 'labels'));
            });
            expect(result[0].output).to.match(/DeleteMe.label-meta.xml$/);
            expect(result[1].output).to.match(/KeepMe1.label-meta.xml$/);
            expect(result[2].output).to.match(/KeepMe2.label-meta.xml$/);
          });
          it('single label in  customLabels', async () => {
            const component = ONE_CUSTOM_LABELS_CMP;
            const xf = new LabelsMetadataTransformer(regAcc);
            const result = await xf.toSourceFormat({ component });
            expect(result).to.have.length(1);
            expect(result[0].output).to.equal(join('main', 'default', 'labels', 'OnlyLabel.label-meta.xml'));
          });
          it('empty customLabels ', async () => {
            const component = EMPTY_CUSTOM_LABELS_CMP;
            const xf = new LabelsMetadataTransformer(regAcc);
            const result = await xf.toSourceFormat({ component });
            expect(result).to.deep.equal([]);
          });
          it('merge component in defaultDir', async () => {
            const component = ONE_CUSTOM_LABELS_CMP;
            const xf = new LabelsMetadataTransformer(regAcc);
            const result = await xf.toSourceFormat({
              component,
              mergeSet: new ComponentSet([ONLY_LABEL_CMP_IN_DEFAULT_DIR_CMP], regAcc),
            });
            expect(result).to.have.length(1);
            expect(result[0].output).to.equal(ONLY_LABEL_CMP_IN_DEFAULT_DIR_CMP.xml!);
          });
        });
      });
      describe('no labels dir', () => {
        it('merge matches label not in a labels dir', async () => {
          const component = ONE_CUSTOM_LABELS_CMP;
          const xf = new LabelsMetadataTransformer(regAcc);
          const result = await xf.toSourceFormat({
            component,
            mergeSet: new ComponentSet([ONLY_LABEL_NO_DIR_CMP], regAcc),
          });
          expect(result).to.have.length(1);
          expect(result[0].output).to.equal(ONLY_LABEL_NO_DIR_CMP.xml!);
        });
      });
      describe('non-default dir', () => {
        it('merge component in nonDefault dir => matches the original location', async () => {
          const component = ONE_CUSTOM_LABELS_CMP;
          const xf = new LabelsMetadataTransformer(regAcc);
          const result = await xf.toSourceFormat({
            component,
            mergeSet: new ComponentSet([ONLY_LABEL_CMP_IN_ANOTHER_DIR_CMP], regAcc),
          });
          expect(result).to.have.length(1);
          expect(result[0].output).to.equal(ONLY_LABEL_CMP_IN_ANOTHER_DIR_CMP.xml!);
        });
        it('merge component in nonDefault dir, but mdapi does not match existing source ', async () => {
          const component = THREE_CUSTOM_LABELS_CMP;
          const xf = new LabelsMetadataTransformer(regAcc);
          const result = await xf.toSourceFormat({
            component,
            mergeSet: new ComponentSet([ONLY_LABEL_CMP_IN_ANOTHER_DIR_CMP], regAcc),
          });
          expect(result).to.have.length(3);
          result.map((l) => {
            expect(l.output).to.include(join('main', 'default', 'labels'));
          });
        });
      });
    });
  });

  describe('LabelMetadataTransformer', () => {
    describe('toMetadataFormat', () => {
      it('should set the customLabelsType in the context', async () => {
        const component = ONLY_LABEL_CMP_IN_DEFAULT_DIR_CMP;
        const xf = new LabelMetadataTransformer(regAcc);
        const result = await xf.toMetadataFormat(component);
        expect(result).to.deep.equal([]);
        expect(xf.context.decomposedLabels.customLabelsType).to.equal(regAcc.getTypeByName('CustomLabels'));
      });
      it('should put the entire CustomLabel xml content into the transactionState', async () => {
        const component = ONLY_LABEL_CMP_IN_DEFAULT_DIR_CMP;
        const xf = new LabelMetadataTransformer(regAcc);
        const result = await xf.toMetadataFormat(component);
        expect(result).to.deep.equal([]);
        expect(xf.context.decomposedLabels.transactionState.customLabelByFullName.size).to.equal(1);
        const stateEntry = xf.context.decomposedLabels.transactionState.customLabelByFullName.get(
          ONLY_LABEL_CMP_IN_DEFAULT_DIR_CMP.fullName
        );
        // component properties are in the state.  We could say the same about the rest of CustomLabel properties
        // but would have to the xml => js and omitNS stuff here to compare
        expect(stateEntry?.fullName).to.deep.equal(component.fullName);
      });
    });
  });
});
