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
import { expect } from 'chai';
import * as sinon from 'sinon';
import { DecodeableMap } from '../../src/collections/decodeableMap';

// passes on dev-scripts 10.2.2, fails on 10.2.4.  I don't know why.
// possibly mocha or types/node
describe('DecodeableMap', () => {
  let dMap: DecodeableMap<string, string>;
  const layout1_key_encoded = 'Layout-v1%2E1 Layout';
  const layout1_key_decoded = 'Layout-v1.1 Layout';
  const layout1_value = 'layout1.1-value';
  const layout9_key_encoded = 'Layout-v9%2E2 Layout';
  const layout9_key_decoded = 'Layout-v9.2 Layout';
  const layout9_value = 'layout9.2-value';
  const nonExistent_key_decoded = 'Layout-v3.3-MISSING Layout';
  const nonExistent_key_encoded = 'Layout-v3%2E3-MISSING Layout';

  const sandbox = sinon.createSandbox();
  let hasMapSpy: sinon.SinonSpy;
  let getMapSpy: sinon.SinonSpy;
  let setMapSpy: sinon.SinonSpy;
  let deleteMapSpy: sinon.SinonSpy;

  beforeEach(() => {
    dMap = new DecodeableMap();
    dMap.set(layout1_key_encoded, layout1_value);
    dMap.set(layout9_key_decoded, layout9_value);
    hasMapSpy = sandbox.spy(Map.prototype, 'has');
    getMapSpy = sandbox.spy(Map.prototype, 'get');
    setMapSpy = sandbox.spy(Map.prototype, 'set');
    deleteMapSpy = sandbox.spy(Map.prototype, 'delete');
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('has()', () => {
    it('should match an encoded key with a decoded key', () => {
      expect(dMap.has(layout1_key_decoded)).to.be.true;
      expect(hasMapSpy.calledWith(layout1_key_decoded)).to.be.true;
      expect(hasMapSpy.calledWith(layout1_key_encoded)).to.be.true;
    });

    it('should match an encoded key with an encoded key', () => {
      expect(dMap.has(layout1_key_encoded)).to.be.true;
      expect(hasMapSpy.calledWith(layout1_key_encoded)).to.be.true;
      expect(hasMapSpy.calledWith(layout1_key_decoded)).to.be.false;
    });

    it('should match a decoded key with a decoded key', () => {
      expect(dMap.has(layout9_key_decoded)).to.be.true;
      expect(hasMapSpy.calledWith(layout9_key_decoded)).to.be.true;
      expect(hasMapSpy.calledWith(layout9_key_encoded)).to.be.false;
    });

    it('should match a decoded key with an encoded key', () => {
      expect(dMap.has(layout9_key_encoded)).to.be.true;
      expect(hasMapSpy.calledWith(layout9_key_encoded)).to.be.true;
      expect(hasMapSpy.calledWith(layout9_key_decoded)).to.be.true;
    });

    it('should not match on decoded nonexistent key', () => {
      expect(dMap.has(nonExistent_key_decoded)).to.be.false;
      expect(hasMapSpy.calledWith(nonExistent_key_decoded)).to.be.true;
      expect(hasMapSpy.calledWith(nonExistent_key_encoded)).to.be.false;
    });

    it('should not match on encoded nonexistent key', () => {
      expect(dMap.has(nonExistent_key_encoded)).to.be.false;
      expect(hasMapSpy.calledWith(nonExistent_key_encoded)).to.be.true;
      expect(hasMapSpy.calledWith(nonExistent_key_decoded)).to.be.true;
    });

    it('should not match non-decodeable key', () => {
      // trying to decode '%E0%A4%A' throws a URIError so DecodeableMap
      // should not throw when a non-decodeable key is encountered.
      expect(dMap.has('%E0%A4%A')).to.be.false;
    });
  });

  describe('get()', () => {
    it('should get value from an encoded key with a decoded key', () => {
      expect(dMap.get(layout1_key_decoded)).to.equal(layout1_value);
      expect(getMapSpy.calledWith(layout1_key_decoded)).to.be.true;
      expect(getMapSpy.calledWith(layout1_key_encoded)).to.be.true;
    });

    it('should get value from an encoded key with an encoded key', () => {
      expect(dMap.get(layout1_key_encoded)).to.equal(layout1_value);
      expect(getMapSpy.calledWith(layout1_key_encoded)).to.be.true;
      expect(getMapSpy.calledWith(layout1_key_decoded)).to.be.false;
    });

    it('should get value from a decoded key with a decoded key', () => {
      expect(dMap.get(layout9_key_decoded)).to.equal(layout9_value);
      expect(getMapSpy.calledWith(layout9_key_decoded)).to.be.true;
      expect(getMapSpy.calledWith(layout9_key_encoded)).to.be.false;
    });

    it('should get value from a decoded key with an encoded key', () => {
      expect(dMap.get(layout9_key_encoded)).to.equal(layout9_value);
      expect(getMapSpy.calledWith(layout9_key_encoded)).to.be.false;
      expect(getMapSpy.calledWith(layout9_key_decoded)).to.be.true;
    });

    it('should return undefined on decoded nonexistent key', () => {
      expect(dMap.get(nonExistent_key_decoded)).to.be.undefined;
      // This is true since it gets from the internal map.
      expect(getMapSpy.calledWith(nonExistent_key_decoded)).to.be.true;
      expect(getMapSpy.calledWith(nonExistent_key_encoded)).to.be.false;
    });

    it('should return undefined on encoded nonexistent key', () => {
      expect(dMap.get(nonExistent_key_encoded)).to.be.undefined;
      expect(getMapSpy.calledWith(nonExistent_key_encoded)).to.be.false;
      expect(getMapSpy.calledWith(nonExistent_key_decoded)).to.be.false;
    });
  });

  describe('set()', () => {
    const NEW_VALUE = 'new value from set';

    it('should update value of decoded key using decoded key', () => {
      expect(dMap.set(layout9_key_decoded, NEW_VALUE)).to.equal(dMap);
      expect(setMapSpy.called).to.be.true;
      expect(setMapSpy.lastCall.args[0]).to.equal(layout9_key_decoded);
      expect(setMapSpy.lastCall.args[1]).to.equal(NEW_VALUE);
      expect(dMap.size).to.equal(2);
      expect(dMap.get(layout9_key_decoded)).to.equal(NEW_VALUE);
      // @ts-ignore testing private map. expect 1 for initial map creation
      expect(dMap.keysMap.size).to.equal(1);
    });

    it('should update value of decoded key using encoded key', () => {
      expect(dMap.set(layout9_key_encoded, NEW_VALUE)).to.equal(dMap);
      expect(setMapSpy.called).to.be.true;
      expect(setMapSpy.lastCall.args[0]).to.equal(layout9_key_decoded);
      expect(setMapSpy.lastCall.args[1]).to.equal(NEW_VALUE);
      expect(dMap.size).to.equal(2);
      expect(dMap.get(layout9_key_encoded)).to.equal(NEW_VALUE);
      // @ts-ignore testing private map. expect 2 for initial map creation and addition
      expect(dMap.keysMap.size).to.equal(2);
      // @ts-ignore testing private map
      expect(dMap.keysMap.get(layout9_key_decoded)).to.equal(layout9_key_encoded);
    });

    it('should update value of encoded key using encoded key', () => {
      expect(dMap.set(layout1_key_encoded, NEW_VALUE)).to.equal(dMap);
      expect(setMapSpy.called).to.be.true;
      expect(setMapSpy.lastCall.args[0]).to.equal(layout1_key_encoded);
      expect(setMapSpy.lastCall.args[1]).to.equal(NEW_VALUE);
      expect(dMap.size).to.equal(2);
      expect(dMap.get(layout1_key_encoded)).to.equal(NEW_VALUE);
      // @ts-ignore testing private map. expect 1 for initial map creation
      expect(dMap.keysMap.size).to.equal(1);
    });

    it('should update value of encoded key using decoded key', () => {
      expect(dMap.set(layout1_key_decoded, NEW_VALUE)).to.equal(dMap);
      expect(setMapSpy.called).to.be.true;
      expect(setMapSpy.lastCall.args[0]).to.equal(layout1_key_encoded);
      expect(setMapSpy.lastCall.args[1]).to.equal(NEW_VALUE);
      expect(dMap.size).to.equal(2);
      expect(dMap.get(layout1_key_encoded)).to.equal(NEW_VALUE);
      // @ts-ignore testing private map. expect 1 for initial map creation
      expect(dMap.keysMap.size).to.equal(1);
    });

    it('should set new entry on decoded nonexistent key', () => {
      expect(dMap.set(nonExistent_key_decoded, NEW_VALUE)).to.equal(dMap);
      expect(setMapSpy.called).to.be.true;
      expect(setMapSpy.lastCall.args[0]).to.equal(nonExistent_key_decoded);
      expect(setMapSpy.lastCall.args[1]).to.equal(NEW_VALUE);
      expect(dMap.size).to.equal(3);
      expect(dMap.get(nonExistent_key_decoded)).to.equal(NEW_VALUE);
      // @ts-ignore testing private map. expect 1 for initial map creation
      expect(dMap.keysMap.size).to.equal(1);
    });

    it('should set new entry on encoded nonexistent key', () => {
      expect(dMap.set(nonExistent_key_encoded, NEW_VALUE)).to.equal(dMap);
      expect(setMapSpy.called).to.be.true;
      expect(setMapSpy.lastCall.args[0]).to.equal(nonExistent_key_encoded);
      expect(setMapSpy.lastCall.args[1]).to.equal(NEW_VALUE);
      expect(dMap.size).to.equal(3);
      expect(dMap.get(nonExistent_key_encoded)).to.equal(NEW_VALUE);
      // @ts-ignore testing private map. expect 2 for initial map creation and addition
      expect(dMap.keysMap.size).to.equal(2);
      // @ts-ignore testing private map
      expect(dMap.keysMap.get(nonExistent_key_decoded)).to.equal(nonExistent_key_encoded);
    });
  });

  describe('delete()', () => {
    it('should delete an encoded key with a decoded key', () => {
      expect(dMap.delete(layout1_key_decoded)).to.be.true;
      expect(deleteMapSpy.calledOnce).to.be.true;
      expect(deleteMapSpy.firstCall.args[0]).to.equal(layout1_key_encoded);
      expect(dMap.size).to.equal(1);
      expect(dMap.has(layout1_key_decoded)).to.be.false;
    });

    it('should delete an encoded key with an encoded key', () => {
      expect(dMap.delete(layout1_key_encoded)).to.be.true;
      expect(deleteMapSpy.calledOnce).to.be.true;
      expect(deleteMapSpy.firstCall.args[0]).to.equal(layout1_key_encoded);
      expect(dMap.size).to.equal(1);
      expect(dMap.has(layout1_key_encoded)).to.be.false;
    });

    it('should delete a decoded key with a decoded key', () => {
      expect(dMap.delete(layout9_key_decoded)).to.be.true;
      expect(deleteMapSpy.calledOnce).to.be.true;
      expect(deleteMapSpy.firstCall.args[0]).to.equal(layout9_key_decoded);
      expect(dMap.size).to.equal(1);
      expect(dMap.has(layout9_key_decoded)).to.be.false;
    });

    it('should delete a decoded key with an encoded key', () => {
      expect(dMap.delete(layout9_key_encoded)).to.be.true;
      expect(deleteMapSpy.calledOnce).to.be.true;
      expect(deleteMapSpy.firstCall.args[0]).to.equal(layout9_key_decoded);
      expect(dMap.size).to.equal(1);
      expect(dMap.has(layout9_key_encoded)).to.be.false;
    });

    it('should not delete a decoded nonexistent key', () => {
      expect(dMap.delete(nonExistent_key_decoded)).to.be.false;
      expect(deleteMapSpy.called).to.be.false;
      expect(dMap.size).to.equal(2);
      expect(dMap.has(nonExistent_key_decoded)).to.be.false;
    });

    it('should not delete an encoded nonexistent key', () => {
      expect(dMap.delete(nonExistent_key_encoded)).to.be.false;
      expect(deleteMapSpy.called).to.be.false;
      expect(dMap.size).to.equal(2);
      expect(dMap.has(nonExistent_key_encoded)).to.be.false;
    });
  });
});
