/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { join } from 'node:path';
import { registry, VirtualFile, VirtualTreeContainer } from '../../src';

export const testApiVersion = 50;
export const testApiVersionAsString = `${testApiVersion}.0`;

export const BASIC: VirtualFile = {
  name: 'basic.xml',
  data: Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
    <types>
        <members>a</members>
        <name>${registry.types.customobjecttranslation.name}</name>
    </types>
    <types>
        <members>b</members>
        <members>c</members>
        <name>${registry.types.staticresource.name}</name>
    </types>
    <version>${testApiVersionAsString}</version>
</Package>\n`),
};

export const ONE_OF_EACH: VirtualFile = {
  name: 'one-of-each.xml',
  data: Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
    <types>
        <members>a</members>
        <name>${registry.types.customobjecttranslation.name}</name>
    </types>
    <types>
        <members>b</members>
        <name>${registry.types.staticresource.name}</name>
    </types>
    <version>${testApiVersionAsString}</version>
</Package>\n`),
};

export const ONE_FOLDER_MEMBER: VirtualFile = {
  name: 'one-folder-member.xml',
  data: Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
    <types>
        <members>Test_Folder</members>
        <name>${registry.types.documentfolder.name}</name>
    </types>
    <version>${testApiVersionAsString}</version>
</Package>\n`),
};

export const IN_FOLDER_WITH_CONTENT: VirtualFile = {
  name: 'in-folder-with-content.xml',
  data: Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
    <types>
        <members>Test_Folder</members>
        <members>Test_Folder/report1</members>
        <members>Test_Folder/report2</members>
        <name>${registry.types.documentfolder.name}</name>
    </types>
    <version>${testApiVersionAsString}</version>
</Package>\n`),
};

export const ONE_WILDCARD: VirtualFile = {
  name: 'one-wildcard.xml',
  data: Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
    <types>
        <members>*</members>
        <name>${registry.types.staticresource.name}</name>
    </types>
    <version>${testApiVersionAsString}</version>
</Package>\n`),
};

export const ONE_PARTIAL_WILDCARD: VirtualFile = {
  name: 'one-partial-wildcard.xml',
  data: Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
    <types>
        <members>site/foo.*</members>
        <name>${registry.types.digitalexperiencebundle.children?.types.digitalexperience.name}</name>
    </types>
    <version>${testApiVersionAsString}</version>
</Package>\n`),
};

export const TREE = new VirtualTreeContainer([
  {
    dirPath: '.',
    children: [
      'objectTranslations',
      'staticresources',
      BASIC,
      ONE_OF_EACH,
      ONE_WILDCARD,
      ONE_PARTIAL_WILDCARD,
      ONE_FOLDER_MEMBER,
      IN_FOLDER_WITH_CONTENT,
    ],
  },
  {
    dirPath: 'objectTranslations',
    children: ['a'],
  },
  {
    dirPath: join('objectTranslations', 'a'),
    children: ['a.objectTranslation-meta.xml', 'child1.fieldTranslation-meta.xml', 'child2.fieldTranslation-meta.xml'],
  },
  {
    dirPath: 'staticresources',
    children: ['b.json', 'b.resource-meta.xml', 'c.csv', 'c.resource-meta.xml'],
  },
]);
