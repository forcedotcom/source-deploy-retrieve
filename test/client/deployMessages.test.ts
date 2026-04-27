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
import { assert, expect, config } from 'chai';
import { ComponentStatus, DeployMessage } from '../../src';
import {
  getState,
  isUiBundleInternalPath,
  isUiBundleResourceMessage,
  uiBundleResourceFullNameToFilePath,
  UI_BUNDLE_RESOURCE_TYPE,
} from '../../src/client/deployMessages';

config.truncateThreshold = 0;

function createDeployMessage(overrides: Partial<DeployMessage>): DeployMessage {
  return {
    changed: 'false',
    created: 'false',
    deleted: 'false',
    success: 'true',
    createdDate: '2026-01-01',
    fileName: 'Test.cls',
    fullName: 'Test',
    ...overrides,
  };
}

describe('deployMessages', () => {
  describe('UI_BUNDLE_RESOURCE_TYPE', () => {
    it('should equal "UIBundleResource"', () => {
      expect(UI_BUNDLE_RESOURCE_TYPE).to.equal('UIBundleResource');
    });
  });

  describe('isUiBundleInternalPath', () => {
    it('should return true for paths ending with webapplicationcontentindex.json', () => {
      assert.isTrue(isUiBundleInternalPath('MyApp/webapplicationcontentindex.json'));
    });

    it('should return true when path is exactly webapplicationcontentindex.json', () => {
      assert.isTrue(isUiBundleInternalPath('webapplicationcontentindex.json'));
    });

    it('should return true for paths containing languageSettings', () => {
      assert.isTrue(isUiBundleInternalPath('MyApp/languageSettings'));
      assert.isTrue(isUiBundleInternalPath('MyApp/languageSettings/en.json'));
    });

    it('should return true for paths containing /languages/', () => {
      assert.isTrue(isUiBundleInternalPath('MyApp/languages/en.json'));
      assert.isTrue(isUiBundleInternalPath('/languages/fr.json'));
    });

    it('should return false for normal content paths', () => {
      assert.isFalse(isUiBundleInternalPath('MyApp/dist/index.html'));
      assert.isFalse(isUiBundleInternalPath('MyApp/assets/logo.png'));
      assert.isFalse(isUiBundleInternalPath('MyApp/main.js'));
    });

    it('should return false for empty string', () => {
      assert.isFalse(isUiBundleInternalPath(''));
    });
  });

  describe('isUiBundleResourceMessage', () => {
    it('should return true when componentType is UIBundleResource', () => {
      const msg = createDeployMessage({ componentType: 'UIBundleResource' });
      assert.isTrue(isUiBundleResourceMessage(msg));
    });

    it('should return false when componentType is a different type', () => {
      const msg = createDeployMessage({ componentType: 'ApexClass' });
      assert.isFalse(isUiBundleResourceMessage(msg));
    });

    it('should return false when componentType is undefined', () => {
      const msg = createDeployMessage({});
      delete msg.componentType;
      assert.isFalse(isUiBundleResourceMessage(msg));
    });

    it('should return false when componentType is not a string', () => {
      // @ts-ignore - testing non-string componentType
      const msg = createDeployMessage({ componentType: 123 });
      assert.isFalse(isUiBundleResourceMessage(msg));
    });
  });

  describe('uiBundleResourceFullNameToFilePath', () => {
    it('should strip the appFullName prefix and join with appContentPath', () => {
      const result = uiBundleResourceFullNameToFilePath('/path/to/MyApp', 'MyApp', 'MyApp/dist/index.html');
      expect(result).to.equal(join('/path/to/MyApp', 'dist', 'index.html'));
    });

    it('should handle nested paths correctly', () => {
      const result = uiBundleResourceFullNameToFilePath('/project/apps/Site', 'Site', 'Site/assets/images/logo.png');
      expect(result).to.equal(join('/project/apps/Site', 'assets', 'images', 'logo.png'));
    });

    it('should use resourceFullName as-is when it does not start with appFullName prefix', () => {
      const result = uiBundleResourceFullNameToFilePath('/path/to/MyApp', 'MyApp', 'OtherApp/dist/index.html');
      expect(result).to.equal(join('/path/to/MyApp', 'OtherApp', 'dist', 'index.html'));
    });

    it('should handle resourceFullName equal to appFullName/ (empty relative path)', () => {
      const result = uiBundleResourceFullNameToFilePath('/path/to/MyApp', 'MyApp', 'MyApp/');
      expect(result).to.equal(join('/path/to/MyApp', ''));
    });

    it('should handle single-segment resourceFullName without prefix match', () => {
      const result = uiBundleResourceFullNameToFilePath('/path/to/MyApp', 'MyApp', 'file.txt');
      expect(result).to.equal(join('/path/to/MyApp', 'file.txt'));
    });
  });

  describe('getState', () => {
    describe('with string BooleanString values', () => {
      it('should return Created when created is "true"', () => {
        const msg = createDeployMessage({ created: 'true', changed: 'false', deleted: 'false', success: 'true' });
        expect(getState(msg)).to.equal(ComponentStatus.Created);
      });

      it('should return Deleted when deleted is "true"', () => {
        const msg = createDeployMessage({ created: 'false', changed: 'false', deleted: 'true', success: 'true' });
        expect(getState(msg)).to.equal(ComponentStatus.Deleted);
      });

      it('should return Changed when changed is "true"', () => {
        const msg = createDeployMessage({ created: 'false', changed: 'true', deleted: 'false', success: 'true' });
        expect(getState(msg)).to.equal(ComponentStatus.Changed);
      });

      it('should return Failed when success is "false"', () => {
        const msg = createDeployMessage({ created: 'false', changed: 'false', deleted: 'false', success: 'false' });
        expect(getState(msg)).to.equal(ComponentStatus.Failed);
      });

      it('should return Unchanged when nothing is true and success is "true"', () => {
        const msg = createDeployMessage({ created: 'false', changed: 'false', deleted: 'false', success: 'true' });
        expect(getState(msg)).to.equal(ComponentStatus.Unchanged);
      });
    });

    describe('with boolean BooleanString values', () => {
      it('should return Created when created is true (boolean)', () => {
        const msg = createDeployMessage({ created: true, changed: false, deleted: false, success: true });
        expect(getState(msg)).to.equal(ComponentStatus.Created);
      });

      it('should return Deleted when deleted is true (boolean)', () => {
        const msg = createDeployMessage({ created: false, changed: false, deleted: true, success: true });
        expect(getState(msg)).to.equal(ComponentStatus.Deleted);
      });

      it('should return Changed when changed is true (boolean)', () => {
        const msg = createDeployMessage({ created: false, changed: true, deleted: false, success: true });
        expect(getState(msg)).to.equal(ComponentStatus.Changed);
      });

      it('should return Failed when success is false (boolean)', () => {
        const msg = createDeployMessage({ created: false, changed: false, deleted: false, success: false });
        expect(getState(msg)).to.equal(ComponentStatus.Failed);
      });

      it('should return Unchanged when all false (boolean)', () => {
        const msg = createDeployMessage({ created: false, changed: false, deleted: false, success: true });
        expect(getState(msg)).to.equal(ComponentStatus.Unchanged);
      });
    });

    describe('priority ordering', () => {
      it('should return Created when both created and changed are true', () => {
        const msg = createDeployMessage({ created: 'true', changed: 'true', deleted: 'false', success: 'true' });
        expect(getState(msg)).to.equal(ComponentStatus.Created);
      });

      it('should return Created when created, deleted, and changed are all true', () => {
        const msg = createDeployMessage({ created: 'true', changed: 'true', deleted: 'true', success: 'true' });
        expect(getState(msg)).to.equal(ComponentStatus.Created);
      });

      it('should return Deleted when both deleted and changed are true (not Changed)', () => {
        const msg = createDeployMessage({ created: 'false', changed: 'true', deleted: 'true', success: 'true' });
        expect(getState(msg)).to.equal(ComponentStatus.Deleted);
      });

      it('should return Deleted (not Changed) with boolean true values for deleted and changed', () => {
        const msg = createDeployMessage({ created: false, changed: true, deleted: true, success: true });
        expect(getState(msg)).to.equal(ComponentStatus.Deleted);
      });

      it('should return Changed over Failed when changed is true even if success is false', () => {
        const msg = createDeployMessage({ created: 'false', changed: 'true', deleted: 'false', success: 'false' });
        expect(getState(msg)).to.equal(ComponentStatus.Changed);
      });
    });
  });
});
