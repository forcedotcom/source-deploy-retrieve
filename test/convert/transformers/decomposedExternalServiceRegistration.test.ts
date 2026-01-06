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
import { expect } from 'chai';
import { createSandbox } from 'sinon';
import { RegistryAccess, VirtualTreeContainer } from '../../../src';
import { getEffectiveRegistry } from '../../../src/registry/variants';
import { presetMap } from '../../../src';
import {
  MD_FORMAT_ESR,
  SAMPLE_OAS_DOC,
  SOURCE_FORMAT_ESR,
} from '../../mock/type-constants/decomposeExternalServiceRegistrationConstants';
import { DecomposeExternalServiceRegistrationTransformer } from '../../../src/convert/transformers/decomposeExternalServiceRegistrationTransformer';

describe('DecomposeExternalServiceRegistrationTransformer', () => {
  const preset = presetMap.get('decomposeExternalServiceRegistrationBeta');
  const regAcc = new RegistryAccess(getEffectiveRegistry({ presets: [preset!] }));

  describe('toSourceFormat', () => {
    describe('WriteInfo output (where the file will write to)', () => {
      it('write yaml file and meta.xml', async () => {
        const component = MD_FORMAT_ESR;
        const xf = new DecomposeExternalServiceRegistrationTransformer(regAcc);
        const result = await xf.toSourceFormat({ component });
        expect(result).to.have.length(2);
        result.map((l) => {
          expect(l.output).to.include(join('externalServiceRegistrations'));
        });
        expect(result[0].output).to.match(/myESR\.yaml$/);
        expect(result[1].output).to.match(/myESR.externalServiceRegistration-meta\.xml$/);
      });

      it('merge component in defaultDir', async () => {
        const component = MD_FORMAT_ESR;
        const xf = new DecomposeExternalServiceRegistrationTransformer(regAcc);
        const result = await xf.toSourceFormat({
          component,
        });
        expect(result).to.have.length(2);
        expect(result[1].output).to.equal(SOURCE_FORMAT_ESR.xml);
      });
    });
  });

  describe('toMetadataFormat', () => {
    const sandbox = createSandbox();

    beforeEach(() => {
      sandbox.stub(VirtualTreeContainer.prototype, 'readFileSync').returns(Buffer.from(SAMPLE_OAS_DOC));
    });

    afterEach(() => {
      sandbox.restore();
    });

    it('decomposed ESR combined to md-format', async () => {
      const component = SOURCE_FORMAT_ESR;
      const xf = new DecomposeExternalServiceRegistrationTransformer(regAcc);
      const result = await xf.toMetadataFormat(component);
      expect(result).to.deep.equal([]);
      expect(xf.context.decomposedExternalServiceRegistration.externalServiceRegistration).to.equal(
        regAcc.getTypeByName('externalServiceRegistration')
      );
    });
  });
});
