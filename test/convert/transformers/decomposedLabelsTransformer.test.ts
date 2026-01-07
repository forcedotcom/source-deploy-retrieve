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
import { expect, assert } from 'chai';
import { parser } from '../../../src/utils/metadata';
import { stream2buffer } from '../../../src/convert/streams';
import { DecomposedLabelsFinalizer } from '../../../src/convert/convertContext/decomposedLabelsFinalizer';
import { ComponentSet } from '../../../src/collections/componentSet';
import { RegistryAccess } from '../../../src/registry/registryAccess';
import {
  EMPTY_CUSTOM_LABELS_CMP,
  ONE_CUSTOM_LABELS_CMP,
  ONLY_LABEL_CMP_IN_ANOTHER_DIR_CMP,
  ONLY_LABEL_CMP_IN_DEFAULT_DIR_CMP,
  ONLY_LABEL_NO_DIR_CMP,
  OTHER_LABEL_CMP,
  THREE_CUSTOM_LABELS_CMP,
} from '../../mock/type-constants/decomposedCustomLabelsConstant';
import {
  LabelMetadataTransformer,
  LabelsMetadataTransformer,
} from '../../../src/convert/transformers/decomposeLabelsTransformer';
import { getEffectiveRegistry } from '../../../src/registry/variants';
import { presetMap } from '../../../src/registry/presets/presetMap';

describe('DecomposedCustomLabelTransformer', () => {
  const regAcc = new RegistryAccess(getEffectiveRegistry({ presets: [presetMap.get('decomposeCustomLabelsBeta2')!] }));

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
    describe('finalizer', () => {
      it('single label from source to mdapi', async () => {
        const component = ONLY_LABEL_CMP_IN_DEFAULT_DIR_CMP;
        const xf = new LabelMetadataTransformer(regAcc);
        await xf.toMetadataFormat(component);
        const finalizer = new DecomposedLabelsFinalizer();
        finalizer.customLabelsType = regAcc.getTypeByName('CustomLabels');
        finalizer.transactionState = xf.context.decomposedLabels.transactionState;
        const result = await finalizer.finalize();
        expect(result).to.have.length(1);
        expect(result[0].component.fullName).to.equal('CustomLabels');
        expect(result[0].component.type.name).to.equal('CustomLabels');
        expect(result[0].writeInfos).to.have.length(1);
        assert(result[0].writeInfos[0].source);
        const contents = (await stream2buffer(result[0].writeInfos[0].source)).toString();
        expect(parser.parse(contents)).to.deep.equal(await ONE_CUSTOM_LABELS_CMP.parseXml());
      });
      it('2 labels from source to mdapi', async () => {
        const component1 = ONLY_LABEL_CMP_IN_DEFAULT_DIR_CMP;
        const component2 = OTHER_LABEL_CMP;
        const xf = new LabelMetadataTransformer(regAcc);
        await xf.toMetadataFormat(component1);
        await xf.toMetadataFormat(component2);
        const finalizer = new DecomposedLabelsFinalizer();
        finalizer.customLabelsType = regAcc.getTypeByName('CustomLabels');
        finalizer.transactionState = xf.context.decomposedLabels.transactionState;
        const result = await finalizer.finalize();
        expect(result).to.have.length(1);
        expect(result[0].component.fullName).to.equal('CustomLabels');
        expect(result[0].component.type.name).to.equal('CustomLabels');
        // still produces only 1 writeInfo
        expect(result[0].writeInfos).to.have.length(1);
        assert(result[0].writeInfos[0].source);
        const contents = (await stream2buffer(result[0].writeInfos[0].source)).toString();
        // with 2 labels in it
        expect(parser.parse(contents).CustomLabels.labels).to.have.length(2);
      });
    });
  });
});
