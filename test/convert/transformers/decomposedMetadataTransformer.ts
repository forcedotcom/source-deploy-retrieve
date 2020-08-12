/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { regina } from '../../mock/registry';
import { DecomposedMetadataTransformer } from '../../../src/convert/transformers/decomposedMetadataTransformer';
import {
  ConvertTransaction,
  RecompositionFinalizer,
} from '../../../src/convert/convertTransaction';
import { expect, assert } from 'chai';
import { createSandbox } from 'sinon';
import * as fs from 'fs';
import { XML_DECL, XML_NS } from '../../../src/utils/constants';
import { Readable } from 'stream';
import { join } from 'path';
import { LibraryError } from '../../../src/errors';
import { nls } from '../../../src/i18n';

const env = createSandbox();

describe('DecomposedMetadataTransformer', () => {
  const component = regina.REGINA_COMPONENT;

  afterEach(() => env.restore());

  it('should register RecompositionFinalizer', () => {
    const transaction = new ConvertTransaction();
    const addFinalizerSpy = env.spy(transaction, 'addFinalizer');

    new DecomposedMetadataTransformer(component, transaction);

    expect(addFinalizerSpy.calledWith(RecompositionFinalizer)).to.be.true;
  });

  describe('toMetadataFormat', () => {
    it('should delay for partial recomposition when a child component is given', () => {
      const child = component.getChildren()[0];
      const transaction = new ConvertTransaction();
      const transformer = new DecomposedMetadataTransformer(child, transaction);

      const writerFormat = transformer.toMetadataFormat();

      expect(writerFormat).to.deep.equal({ component: child, writeInfos: [] });
      expect(transaction.state).to.deep.equal({
        recompose: {
          [component.fullName]: {
            component,
            children: [child],
          },
        },
      });
    });

    it('should fully recompose metadata when a parent component is given', () => {
      const transformer = new DecomposedMetadataTransformer(component, new ConvertTransaction());
      const children = component.getChildren();
      const readStub = env.stub(fs, 'readFileSync');
      readStub.withArgs(children[0].xml).returns('<Y><test>child1</test></Y>');
      readStub.withArgs(children[1].xml).returns('<X><test>child2</test></X>');
      readStub
        .withArgs(component.xml)
        .returns(`${XML_DECL}<ReginaKing xmlns="${XML_NS}"><foo>bar</foo></ReginaKing>\n`);

      const result = transformer.toMetadataFormat();

      const expectedStr = `${XML_DECL}<ReginaKing xmlns="${XML_NS}">\n  <foo>bar</foo>\n  <ys>\n    <test>child1</test>\n  </ys>\n  <xs>\n    <test>child2</test>\n  </xs>\n</ReginaKing>\n`;
      const source = new Readable();
      source.push(expectedStr);
      source.push(null);

      expect(result).to.deep.equal({
        component,
        writeInfos: [
          {
            relativeDestination: join('reginas', 'a.regina'),
            source,
          },
        ],
      });
    });

    describe('toSourceFormat', () => {
      it('should throw a not implemented error', () => {
        const transformer = new DecomposedMetadataTransformer(component, new ConvertTransaction());

        assert.throws(
          () => transformer.toSourceFormat(),
          LibraryError,
          nls.localize('error_convert_not_implemented', ['source', component.type.name])
        );
      });
    });
  });
});
