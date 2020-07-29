/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { QueryResult } from '../../src/client/types';

export const lwcComponentMock: QueryResult = {
  size: 4,
  totalSize: 4,
  done: true,
  queryLocator: null,
  entityTypeName: 'LightningComponentResource',
  records: [
    {
      Id: '0Rdxx000000xxxxSAU',
      LightningComponentBundle: {
        DeveloperName: 'myLWCComponent',
        NamespacePrefix: '',
      },
      FilePath: 'lwc/myLWCComponent/myLWCComponent.js',
      Source:
        "import { LightningElement } from 'lwc';\n\nexport default class myLWCComponent extends LightningElement {}",
    },
    {
      Id: '0Rdxx000000xxxxSAU',
      LightningComponentBundle: {
        DeveloperName: 'myLWCComponent',
        NamespacePrefix: '',
      },
      FilePath: 'lwc/myLWCComponent/myLWCComponent.html',
      Source: '<template>\n    \n</template>',
    },
    {
      Id: '0Rdxx000000xxxxSAU',
      LightningComponentBundle: {
        DeveloperName: 'myLWCComponent',
        NamespacePrefix: '',
      },
      FilePath: 'lwc/myLWCComponent/myLWCComponent.css',
      Source:
        ':host {\n    position: relative;\n    display: block;\n}\n\nimg,\nvideo {\n    position: relative;\n    width: 100%;\n}',
    },
    {
      Id: '0Rdxx000000xxxxSAU',
      LightningComponentBundle: {
        DeveloperName: 'myLWCComponent',
        NamespacePrefix: '',
      },
      FilePath: 'lwc/myLWCComponent/myLWCComponent.js-meta.xml',
      Source:
        '<?xml version="1.0" encoding="UTF-8" ?>\n<LightningComponentBundle xmlns="http://soap.sforce.com/2006/04/metadata">\n    <apiVersion>46.0</apiVersion>\n</LightningComponentBundle>',
    },
  ],
};
