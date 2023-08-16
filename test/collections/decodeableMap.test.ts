/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect } from 'chai';
import * as sinon from 'sinon';
import { DecodeableMap } from '../../src/collections/decodeableMap';

describe('DecodeableMap', () => {
  let dMap: DecodeableMap<string, string>;
  const ENCODED_KEY = 'encodedKey';
  const DECODED_KEY = 'decodedKey';

  const sandbox = sinon.createSandbox();
  let hasDecodedSpy: sinon.SinonSpy;
  let getDecodedSpy: sinon.SinonSpy;
  let hasMapSpy: sinon.SinonSpy;
  let getMapSpy: sinon.SinonSpy;
  let setMapSpy: sinon.SinonSpy;
  let deleteMapSpy: sinon.SinonSpy;

  beforeEach(() => {
    dMap = new DecodeableMap([
      ['Layout-v1%2E1 Layout', ENCODED_KEY],
      ['Layout-v9.2 Layout', DECODED_KEY],
    ]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    hasDecodedSpy = sandbox.spy(dMap, 'hasDecoded' as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getDecodedSpy = sandbox.spy(dMap, 'getDecoded' as any);
    hasMapSpy = sandbox.spy(Map.prototype, 'has');
    getMapSpy = sandbox.spy(Map.prototype, 'get');
    setMapSpy = sandbox.spy(Map.prototype, 'set');
    deleteMapSpy = sandbox.spy(Map.prototype, 'delete');
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('has()', () => {
    it('should match on exact key without decoding', () => {
      expect(dMap.has('Layout-v1%2E1 Layout')).to.be.true;
      expect(hasMapSpy.called).to.be.true;
      expect(hasDecodedSpy.called).to.be.false;
    });

    it('should match encoded key with decoded value', () => {
      expect(dMap.has('Layout-v1.1 Layout')).to.be.true;
      expect(hasMapSpy.called).to.be.true;
      expect(hasDecodedSpy.called).to.be.true;
    });

    it('should match decoded key with encoded value', () => {
      expect(dMap.has('Layout-v9%2E2 Layout')).to.be.true;
      expect(hasMapSpy.called).to.be.true;
      expect(hasDecodedSpy.called).to.be.true;
    });

    it('should not match on no existing key', () => {
      expect(dMap.has('Layout-MISSING Layout')).to.be.false;
      expect(hasMapSpy.called).to.be.true;
      expect(hasDecodedSpy.called).to.be.true;
    });
  });

  describe('get()', () => {
    it('should get value with exact key without decoding', () => {
      expect(dMap.get('Layout-v1%2E1 Layout')).to.equal(ENCODED_KEY);
      expect(getMapSpy.calledOnce).to.be.true;
      expect(getDecodedSpy.called).to.be.false;
    });

    it('should get value of encoded key using decoded key', () => {
      expect(dMap.get('Layout-v1.1 Layout')).to.equal(ENCODED_KEY);
      expect(getMapSpy.calledTwice).to.be.true;
      expect(getDecodedSpy.calledOnce).to.be.true;
    });

    it('should get value of decoded key using encoded key', () => {
      expect(dMap.get('Layout-v9%2E2 Layout')).to.equal(DECODED_KEY);
      expect(getMapSpy.calledTwice).to.be.true;
      expect(getDecodedSpy.calledOnce).to.be.true;
    });

    it('should return undefined on no existing key', () => {
      expect(dMap.get('Layout-MISSING Layout')).to.be.undefined;
      expect(getMapSpy.calledOnce).to.be.true;
      expect(getDecodedSpy.called).to.be.true;
    });
  });

  describe('set()', () => {
    const NEW_VALUE = 'new value from set';

    it('should set value with exact key', () => {
      expect(dMap.set('Layout-v1%2E1 Layout', NEW_VALUE)).to.equal(dMap);
      expect(setMapSpy.called).to.be.true;
      expect(setMapSpy.lastCall.args[0]).to.equal('Layout-v1%2E1 Layout');
      expect(setMapSpy.lastCall.args[1]).to.equal(NEW_VALUE);
      expect(dMap.size).to.equal(2);
      expect(dMap.get('Layout-v1%2E1 Layout')).to.equal(NEW_VALUE);
    });

    it('should set value of encoded key using decoded key', () => {
      expect(dMap.set('Layout-v1.1 Layout', NEW_VALUE)).to.equal(dMap);
      expect(setMapSpy.called).to.be.true;
      expect(setMapSpy.lastCall.args[0]).to.equal('Layout-v1%2E1 Layout');
      expect(setMapSpy.lastCall.args[1]).to.equal(NEW_VALUE);
      expect(dMap.size).to.equal(2);
      expect(dMap.get('Layout-v1%2E1 Layout')).to.equal(NEW_VALUE);
    });

    it('should set value of decoded key using encoded key', () => {
      expect(dMap.set('Layout-v9%2E2 Layout', NEW_VALUE)).to.equal(dMap);
      expect(setMapSpy.called).to.be.true;
      expect(setMapSpy.lastCall.args[0]).to.equal('Layout-v9.2 Layout');
      expect(setMapSpy.lastCall.args[1]).to.equal(NEW_VALUE);
      expect(dMap.size).to.equal(2);
      expect(dMap.get('Layout-v9.2 Layout')).to.equal(NEW_VALUE);
    });

    it('should set new entry on no existing key', () => {
      expect(dMap.set('Layout-MISSING Layout', NEW_VALUE)).to.equal(dMap);
      expect(setMapSpy.called).to.be.true;
      expect(setMapSpy.lastCall.args[0]).to.equal('Layout-MISSING Layout');
      expect(setMapSpy.lastCall.args[1]).to.equal(NEW_VALUE);
      expect(dMap.size).to.equal(3);
      expect(dMap.get('Layout-MISSING Layout')).to.equal(NEW_VALUE);
    });
  });

  describe('delete()', () => {
    it('should delete using exact key', () => {
      expect(dMap.delete('Layout-v1%2E1 Layout')).to.be.true;
      expect(deleteMapSpy.calledOnce).to.be.true;
      expect(deleteMapSpy.firstCall.args[0]).to.equal('Layout-v1%2E1 Layout');
      expect(dMap.size).to.equal(1);
      expect(dMap.has('Layout-v1%2E1 Layout')).to.be.false;
    });

    it('should delete the encoded key using decoded value', () => {
      expect(dMap.delete('Layout-v1.1 Layout')).to.be.true;
      expect(deleteMapSpy.calledOnce).to.be.true;
      expect(deleteMapSpy.firstCall.args[0]).to.equal('Layout-v1%2E1 Layout');
      expect(dMap.size).to.equal(1);
      expect(dMap.has('Layout-v1.1 Layout')).to.be.false;
    });

    it('should delete the decoded key using encoded value', () => {
      expect(dMap.delete('Layout-v9%2E2 Layout')).to.be.true;
      expect(deleteMapSpy.calledOnce).to.be.true;
      expect(deleteMapSpy.firstCall.args[0]).to.equal('Layout-v9.2 Layout');
      expect(dMap.size).to.equal(1);
      expect(dMap.has('Layout-v9%2E2 Layout')).to.be.false;
    });

    it('should not delete on no existing key', () => {
      expect(dMap.delete('Layout-MISSING Layout')).to.be.false;
      expect(deleteMapSpy.calledOnce).to.be.true;
      expect(deleteMapSpy.firstCall.args[0]).to.equal('Layout-MISSING Layout');
      expect(dMap.size).to.equal(2);
      expect(dMap.has('Layout-MISSING Layout')).to.be.false;
    });
  });
});
