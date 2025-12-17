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
import { computeWebAppPathName, isWebAppBundle } from '../../src/client/utils';
import { SourceComponent, registry } from '../../src';

describe('client/utils', () => {
  describe('computeWebAppPathName', () => {
    it('should return path-based name for web_app bundle file', () => {
      const filePath = join(
        'force-app',
        'main',
        'default',
        'digitalExperiences',
        'web_app',
        'ReactDemo',
        'src',
        'App.jsx'
      );
      const result = computeWebAppPathName(filePath);
      expect(result).to.equal('web_app/ReactDemo/src/App.jsx');
    });

    it('should handle nested directories', () => {
      const filePath = join(
        'force-app',
        'main',
        'default',
        'digitalExperiences',
        'web_app',
        'MyApp',
        'src',
        'components',
        'Button.jsx'
      );
      const result = computeWebAppPathName(filePath);
      expect(result).to.equal('web_app/MyApp/src/components/Button.jsx');
    });

    it('should handle webapp.json file', () => {
      const filePath = join(
        'force-app',
        'main',
        'default',
        'digitalExperiences',
        'web_app',
        'ReactDemo',
        'webapp.json'
      );
      const result = computeWebAppPathName(filePath);
      expect(result).to.equal('web_app/ReactDemo/webapp.json');
    });

    it('should handle public directory files', () => {
      const filePath = join(
        'force-app',
        'main',
        'default',
        'digitalExperiences',
        'web_app',
        'ReactDemo',
        'public',
        'index.html'
      );
      const result = computeWebAppPathName(filePath);
      expect(result).to.equal('web_app/ReactDemo/public/index.html');
    });

    it('should return original path if digitalExperiences not found', () => {
      const filePath = join('some', 'other', 'path', 'file.js');
      const result = computeWebAppPathName(filePath);
      expect(result).to.equal(filePath);
    });

    it('should always use forward slashes in output', () => {
      const filePath = join('project', 'digitalExperiences', 'web_app', 'Demo', 'src', 'index.js');
      const result = computeWebAppPathName(filePath);
      expect(result).to.not.include('\\');
      expect(result).to.equal('web_app/Demo/src/index.js');
    });
  });

  describe('isWebAppBundle', () => {
    it('should return true for web_app DigitalExperienceBundle with content', () => {
      const component = new SourceComponent({
        name: 'web_app/ReactDemo',
        type: registry.types.digitalexperiencebundle,
        content: '/path/to/digitalExperiences/web_app/ReactDemo',
      });
      expect(isWebAppBundle(component)).to.be.true;
    });

    it('should return false for non-web_app DigitalExperienceBundle', () => {
      const component = new SourceComponent({
        name: 'site/MySite',
        type: registry.types.digitalexperiencebundle,
        content: '/path/to/digitalExperiences/site/MySite',
      });
      expect(isWebAppBundle(component)).to.be.false;
    });

    it('should return false for DigitalExperienceBundle without content', () => {
      const component = new SourceComponent({
        name: 'web_app/ReactDemo',
        type: registry.types.digitalexperiencebundle,
      });
      expect(isWebAppBundle(component)).to.be.false;
    });

    it('should return false for non-DigitalExperienceBundle type', () => {
      const component = new SourceComponent({
        name: 'MyClass',
        type: registry.types.apexclass,
        content: '/path/to/classes/MyClass.cls',
      });
      expect(isWebAppBundle(component)).to.be.false;
    });
  });
});
