/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { Localization, Message } from '../../src/i18n';
import * as i18n from './i18n';

/**
 * This snippet of code needs to be copied/generated to all localization points.
 */
function loadMessageBundle(): Message {
  return new Message(i18n.messages);
}

describe('Localization tests', () => {
  it('Should handle default locale', () => {
    const nls = new Localization(loadMessageBundle());
    expect(nls.localize('key_1')).to.be.equals('Hello');
  });

  it('Should not fail if a key is missing in default locale', () => {
    const nls = new Localization(loadMessageBundle());
    expect(nls.localize('non_existent_key')).to.be.equals('!!! MISSING LABEL !!! non_existent_key');
  });

  it('Should not error if arg counts do no match', () => {
    const nls = new Localization(loadMessageBundle());
    expect(() => nls.localize('key_3')).to.not.throw();
  });

  it('Should perform substitution in default locale if args >=1', () => {
    const nls = new Localization(loadMessageBundle());
    expect(nls.localize('key_3_with_args', 'John')).to.be.equals('Hello John');
  });

  it('Should perform substitution in default locale if args >=1 with an array', () => {
    const nls = new Localization(loadMessageBundle());
    expect(nls.localize('key_3_with_args', ['John'])).to.be.equals('Hello John');
  });

  it('Should append args for missing label', () => {
    const nls = new Localization(loadMessageBundle());
    expect(nls.localize('non_existent_key', 'John')).to.be.equals(
      '!!! MISSING LABEL !!! non_existent_key (John)'
    );
  });
});
