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
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Package xmlns="http://soap.sforce.com/2006/04/metadata"><types><members>someName</members><name>ApexClass</name></types><version>48.0</version></Package>'
    );
  });

  it('should generate manifest for multiple types', () => {
    const component1 = {
      fullName: 'apexClass1',
      type: { name: 'ApexClass' },
      xml: '',
      sources: []
    } as MetadataComponent;

    const component2 = {
      fullName: 'apexTrigger1',
      type: { name: 'ApexTrigger' },
      xml: '',
      sources: []
    } as MetadataComponent;

    expect(manifestGenerator.createManifest([component1, component2])).to.equal(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Package xmlns="http://soap.sforce.com/2006/04/metadata"><types><members>apexClass1</members><name>ApexClass</name></types><types><members>apexTrigger1</members><name>ApexTrigger</name></types><version>48.0</version></Package>'
    );
  });

  it('should generate manifest for multiple components', () => {
    const component1 = {
      fullName: 'apexClass1',
      type: { name: 'ApexClass' },
      xml: '',
      sources: []
    } as MetadataComponent;

    const component2 = {
      fullName: 'apexClass2',
      type: { name: 'ApexClass' },
      xml: '',
      sources: []
    } as MetadataComponent;

    const component3 = {
      fullName: 'apexTrigger1',
      type: { name: 'ApexTrigger' },
      xml: '',
      sources: []
    } as MetadataComponent;

    expect(
      manifestGenerator.createManifest([component1, component2, component3])
    ).to.equal(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Package xmlns="http://soap.sforce.com/2006/04/metadata"><types><members>apexClass1</members><members>apexClass2</members><name>ApexClass</name></types><types><members>apexTrigger1</members><name>ApexTrigger</name></types><version>48.0</version></Package>'
    );
  });

  it('should generate manifest for multiple components passed in different order', () => {
    const component1 = {
      fullName: 'apexClass1',
      type: { name: 'ApexClass' },
      xml: '',
      sources: []
    } as MetadataComponent;

    const component2 = {
      fullName: 'apexClass2',
      type: { name: 'ApexClass' },
      xml: '',
      sources: []
    } as MetadataComponent;

    const component3 = {
      fullName: 'apexTrigger1',
      type: { name: 'ApexTrigger' },
      xml: '',
      sources: []
    } as MetadataComponent;

    expect(
      manifestGenerator.createManifest([component1, component3, component2])
    ).to.equal(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Package xmlns="http://soap.sforce.com/2006/04/metadata"><types><members>apexClass1</members><members>apexClass2</members><name>ApexClass</name></types><types><members>apexTrigger1</members><name>ApexTrigger</name></types><version>48.0</version></Package>'
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
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Package xmlns="http://soap.sforce.com/2006/04/metadata"><types><members>someName</members><name>ApexClass</name></types><version>45.0</version></Package>'
    );
  });
});
