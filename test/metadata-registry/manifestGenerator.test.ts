/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ManifestGenerator } from '../../src/metadata-registry/manifestGenerator';
import { MetadataComponent } from '../../src/metadata-registry/types';
import { expect } from 'chai';

describe('ManifestGenerator', () => {
  const manifestGenerator = new ManifestGenerator();

  it('should generate manifest for one type', () => {
    const component = {
      fullName: 'someName',
      type: { name: 'ApexClass' },
      xml: '',
      sources: []
    } as MetadataComponent;
    expect(manifestGenerator.createManifest([component])).to.equal(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Package xmlns="http://soap.sforce.com/2006/04/metadata"><types><members>*</members><name>ApexClass</name></types><version>48.0</version></Package>'
    );
  });

  it('should generate manifest for multiple types', () => {
    const component1 = {
      fullName: 'someName',
      type: { name: 'ApexClass' },
      xml: '',
      sources: []
    } as MetadataComponent;

    const component2 = {
      fullName: 'someName',
      type: { name: 'ApexTrigger' },
      xml: '',
      sources: []
    } as MetadataComponent;

    expect(manifestGenerator.createManifest([component1, component2])).to.equal(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Package xmlns="http://soap.sforce.com/2006/04/metadata"><types><members>*</members><name>ApexClass</name></types><types><members>*</members><name>ApexTrigger</name></types><version>48.0</version></Package>'
    );
  });

  it('should generate manifest by overriding apiversion', () => {
    const component = {
      fullName: 'someName',
      type: { name: 'ApexClass' },
      xml: '',
      sources: []
    } as MetadataComponent;
    expect(manifestGenerator.createManifest([component], '45.0')).to.equal(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Package xmlns="http://soap.sforce.com/2006/04/metadata"><types><members>*</members><name>ApexClass</name></types><version>45.0</version></Package>'
    );
  });
});
