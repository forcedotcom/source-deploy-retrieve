/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ManifestGenerator } from '../../src/metadata-registry/manifestGenerator';
import { MetadataComponent } from '../../src/types';
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

    let expectedManifest =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
    expectedManifest +=
      '<Package xmlns="http://soap.sforce.com/2006/04/metadata">\n';
    expectedManifest +=
      '\t<types>\n\t\t<members>someName</members>\n\t\t<name>ApexClass</name>\n\t</types>\n';
    expectedManifest += '\t<version>48.0</version>\n</Package>\n';

    expect(manifestGenerator.createManifest([component])).to.equal(
      expectedManifest
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

    let expectedManifest =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
    expectedManifest +=
      '<Package xmlns="http://soap.sforce.com/2006/04/metadata">\n';
    expectedManifest +=
      '\t<types>\n\t\t<members>apexClass1</members>\n\t\t<name>ApexClass</name>\n\t</types>\n';
    expectedManifest +=
      '\t<types>\n\t\t<members>apexTrigger1</members>\n\t\t<name>ApexTrigger</name>\n\t</types>\n';
    expectedManifest += '\t<version>48.0</version>\n</Package>\n';

    expect(manifestGenerator.createManifest([component1, component2])).to.equal(
      expectedManifest
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

    let expectedManifest =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
    expectedManifest +=
      '<Package xmlns="http://soap.sforce.com/2006/04/metadata">\n';
    expectedManifest +=
      '\t<types>\n\t\t<members>apexClass1</members>\n\t\t<members>apexClass2</members>\n\t\t<name>ApexClass</name>\n\t</types>\n';
    expectedManifest +=
      '\t<types>\n\t\t<members>apexTrigger1</members>\n\t\t<name>ApexTrigger</name>\n\t</types>\n';
    expectedManifest += '\t<version>48.0</version>\n</Package>\n';

    expect(
      manifestGenerator.createManifest([component1, component2, component3])
    ).to.equal(expectedManifest);
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

    let expectedManifest =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
    expectedManifest +=
      '<Package xmlns="http://soap.sforce.com/2006/04/metadata">\n';
    expectedManifest +=
      '\t<types>\n\t\t<members>apexClass1</members>\n\t\t<members>apexClass2</members>\n\t\t<name>ApexClass</name>\n\t</types>\n';
    expectedManifest +=
      '\t<types>\n\t\t<members>apexTrigger1</members>\n\t\t<name>ApexTrigger</name>\n\t</types>\n';
    expectedManifest += '\t<version>48.0</version>\n</Package>\n';

    expect(
      manifestGenerator.createManifest([component1, component3, component2])
    ).to.equal(expectedManifest);
  });

  it('should generate manifest by overriding apiversion', () => {
    const component = {
      fullName: 'someName',
      type: { name: 'ApexClass' },
      xml: '',
      sources: []
    } as MetadataComponent;

    let expectedManifest =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
    expectedManifest +=
      '<Package xmlns="http://soap.sforce.com/2006/04/metadata">\n';
    expectedManifest +=
      '\t<types>\n\t\t<members>someName</members>\n\t\t<name>ApexClass</name>\n\t</types>\n';
    expectedManifest += '\t<version>45.0</version>\n</Package>\n';

    expect(manifestGenerator.createManifest([component], '45.0')).to.equal(
      expectedManifest
    );
  });

  it('should throw error for non valid type', () => {
    const component = {
      fullName: 'someName',
      type: { name: 'someveryunknowntype' },
      xml: '',
      sources: []
    } as MetadataComponent;
    try {
      manifestGenerator.createManifest([component]);
      expect.fail('should have failed');
    } catch (e) {
      expect(e.message).to.equal(
        "Missing metadata type definition in registry for id 'someveryunknowntype'"
      );
    }
  });
});
