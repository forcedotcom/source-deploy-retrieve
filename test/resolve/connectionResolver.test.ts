/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { MockTestOrgData, testSetup } from '@salesforce/core/lib/testSetup';
import { createSandbox, SinonSandbox } from 'sinon';
import { Connection } from '@salesforce/core';
import { mockConnection } from '../mock/client';
import { ConnectionResolver } from '../../src/resolve';
import { MetadataComponent, registry } from '../../src/';

const $$ = testSetup();

const StdFileProperty = {
  createdById: 'createdById',
  createdByName: 'createdByName',
  createdDate: 'createdDate',
  id: 'id',
  lastModifiedById: 'lastModifiedById',
  lastModifiedByName: 'lastModifiedByName',
  lastModifiedDate: 'lastModifiedDate',
};

describe('ConnectionResolver', () => {
  let sandboxStub: SinonSandbox;
  let connection: Connection;
  const testData = new MockTestOrgData();

  beforeEach(async () => {
    sandboxStub = createSandbox();
    $$.setConfigStubContents('AuthInfoConfig', {
      contents: await testData.getConfig(),
    });
    connection = await mockConnection($$);
  });

  afterEach(() => {
    sandboxStub.restore();
  });

  describe('resolve', () => {
    it('should resolve parent and child components', async () => {
      const metadataQueryStub = sandboxStub.stub(connection.metadata, 'list');

      metadataQueryStub.withArgs({ type: 'CustomObject' }).resolves([
        {
          ...StdFileProperty,
          fileName: 'objects/Account.object',
          fullName: 'Account',
          type: 'CustomObject',
        },
      ]);
      metadataQueryStub.withArgs({ type: 'CustomField' }).resolves([
        {
          ...StdFileProperty,
          fileName: 'objects/Account.object',
          fullName: 'Account.testc',
          type: 'CustomField',
        },
        {
          ...StdFileProperty,
          fileName: 'objects/Account.object',
          fullName: 'Account.testa',
          type: 'CustomField',
        },
        {
          ...StdFileProperty,
          fileName: 'objects/Account.object',
          fullName: 'Account.testb',
          type: 'CustomField',
        },
      ]);

      const resolver = new ConnectionResolver(connection);
      const result = await resolver.resolve();
      const expected: MetadataComponent[] = [
        {
          fullName: 'Account',
          type: registry.types.customobject,
        },
        {
          fullName: 'Account.testc',
          type: registry.types.customobject.children.types.customfield,
        },
        {
          fullName: 'Account.testa',
          type: registry.types.customobject.children.types.customfield,
        },
        {
          fullName: 'Account.testb',
          type: registry.types.customobject.children.types.customfield,
        },
      ];
      expect(result.components).to.deep.equal(expected);
    });
    it('should resolve components with different types', async () => {
      const metadataQueryStub = sandboxStub.stub(connection.metadata, 'list');

      metadataQueryStub.withArgs({ type: 'CustomLabels' }).resolves([
        {
          ...StdFileProperty,
          fileName: 'labels/CustomLabels.labels',
          fullName: 'Account',
          type: 'CustomLabels',
        },
      ]);
      metadataQueryStub.withArgs({ type: 'Workflow' }).resolves([
        {
          ...StdFileProperty,
          fileName: 'workflows/Account.workflow',
          fullName: 'Account',
          type: 'Workflow',
        },
      ]);

      const resolver = new ConnectionResolver(connection);
      const result = await resolver.resolve();
      const expected: MetadataComponent[] = [
        {
          fullName: 'Account',
          type: registry.types.customlabels,
        },
        {
          fullName: 'Account',
          type: registry.types.workflow,
        },
      ];
      expect(result.components).to.deep.equal(expected);
    });
    it('should resolve components with invalid type returned by metadata api', async () => {
      const metadataQueryStub = sandboxStub.stub(connection.metadata, 'list');
      metadataQueryStub.withArgs({ type: 'CustomLabels' }).resolves([
        {
          ...StdFileProperty,
          fileName: 'standardValueSetTranslations/CaseOrigin-de.standardValueSetTranslation',
          fullName: 'CaseOrigin-de',
          // @ts-ignore
          type: { $: { 'xsi:nil': 'true' } },
        },
      ]);

      const resolver = new ConnectionResolver(connection);
      const result = await resolver.resolve();
      const expected: MetadataComponent[] = [
        {
          fullName: 'CaseOrigin-de',
          type: registry.types.standardvaluesettranslation,
        },
      ];
      expect(result.components).to.deep.equal(expected);
    });
    it('should resolve components with folderContentType', async () => {
      const metadataQueryStub = sandboxStub.stub(connection.metadata, 'list');

      metadataQueryStub.withArgs({ type: 'EmailFolder' }).resolves([
        {
          ...StdFileProperty,
          fileName: 'unfiled$public',
          fullName: 'unfiled$public',
          type: 'EmailFolder',
        },
      ]);
      metadataQueryStub.withArgs({ type: 'EmailTemplate' }).resolves([
        {
          ...StdFileProperty,
          fileName: 'email/unfiled$public/test.email',
          fullName: 'unfiled$public/test',
          type: 'EmailTemplate',
        },
      ]);

      const resolver = new ConnectionResolver(connection);
      const result = await resolver.resolve();
      const expected: MetadataComponent[] = [
        {
          fullName: 'unfiled$public/test',
          type: registry.types.emailtemplate,
        },
        {
          fullName: 'unfiled$public',
          type: registry.types.emailfolder,
        },
      ];
      expect(result.components).to.deep.equal(expected);
    });
    it('should catch error if MetadataType is not supported', async () => {
      const metadataQueryStub = sandboxStub.stub(connection.metadata, 'list');

      metadataQueryStub
        .withArgs({ type: 'EventType' })
        .throws(new Error('INVALID_TYPE: Cannot use: EventType in this version'));

      const resolver = new ConnectionResolver(connection);
      const result = await resolver.resolve();
      expect(result.components).to.deep.equal([]);
    });
    it('should resolve standardValueSet components from tooling api', async () => {
      sandboxStub.stub(connection.metadata, 'list');

      const mockToolingQuery = sandboxStub.stub(connection, 'singleRecordQuery');
      mockToolingQuery
        .withArgs("SELECT Id, MasterLabel, Metadata FROM StandardValueSet WHERE MasterLabel = 'AccountOwnership'")
        .resolves({
          Id: '00X1x000003Hs4ZEAS',
          MasterLabel: 'AccountOwnership',
          Metadata: {
            standardValue: [
              {
                property: null,
              },
            ],
          },
        });

      mockToolingQuery
        .withArgs(
          "SELECT Id, MasterLabel, Metadata FROM StandardValueSet WHERE MasterLabel = 'AccountContactMultiRoles'"
        )
        .resolves({
          Id: '00X1x000003Hs4ZEAS',
          MasterLabel: 'AccountContactMultiRoles',
        });

      const resolver = new ConnectionResolver(connection);
      const result = await resolver.resolve();
      const expected: MetadataComponent[] = [
        {
          fullName: 'AccountOwnership',
          type: registry.types.standardvalueset,
        },
      ];
      expect(result.components).to.deep.equal(expected);
    });
    it('should resolve no managed components', async () => {
      const metadataQueryStub = sandboxStub.stub(connection.metadata, 'list');

      metadataQueryStub.withArgs({ type: 'DashboardFolder' }).resolves([
        {
          ...StdFileProperty,
          fileName: 'dashboards/SK__Knowledge_Dashboard',
          fullName: 'SK__Knowledge_Dashboard',
          manageableState: 'installed',
          namespacePrefix: 'SK',
          type: 'DashboardFolder',
        },
      ]);
      metadataQueryStub.withArgs({ type: 'InstalledPackage' }).resolves([
        {
          ...StdFileProperty,
          fileName: 'installedPackages/SK.installedPackage',
          fullName: 'SK',
          namespacePrefix: 'SK',
          type: 'InstalledPackage',
        },
      ]);

      const resolver = new ConnectionResolver(connection);
      const result = await resolver.resolve(
        (component) => !(component.namespacePrefix && component.manageableState !== 'unmanaged')
      );
      expect(result.components).to.deep.equal([]);
    });
    it('should resolve managed components if excludeManaged is false', async () => {
      const metadataQueryStub = sandboxStub.stub(connection.metadata, 'list');

      metadataQueryStub.withArgs({ type: 'DashboardFolder' }).resolves([
        {
          ...StdFileProperty,
          fileName: 'dashboards/SK__Knowledge_Dashboard',
          fullName: 'SK__Knowledge_Dashboard',
          manageableState: 'installed',
          namespacePrefix: 'SK',
          type: 'DashboardFolder',
        },
      ]);
      metadataQueryStub.withArgs({ type: 'InstalledPackage' }).resolves([
        {
          ...StdFileProperty,
          fileName: 'installedPackages/SK.installedPackage',
          fullName: 'SK',
          namespacePrefix: 'SK',
          type: 'InstalledPackage',
        },
      ]);

      const resolver = new ConnectionResolver(connection);
      const result = await resolver.resolve();
      const expected: MetadataComponent[] = [
        {
          fullName: 'SK',
          type: registry.types.installedpackage,
        },
        {
          fullName: 'SK__Knowledge_Dashboard',
          type: registry.types.dashboardfolder,
        },
      ];
      expect(result.components).to.deep.equal(expected);
    });
  });
});
