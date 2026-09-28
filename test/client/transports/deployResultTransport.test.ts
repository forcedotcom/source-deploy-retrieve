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

import { expect } from 'chai';
import {
  AsyncTransportHandle,
  ComponentStatus,
  DeployResult,
  FileResponse,
  MetadataApiDeployStatus,
  RequestStatus,
} from '../../../src';

function createDeployStatus(overrides: Partial<MetadataApiDeployStatus> = {}): MetadataApiDeployStatus {
  return {
    id: '0Af000000000000',
    status: RequestStatus.Succeeded,
    success: true,
    done: true,
    checkOnly: false,
    createdBy: '005000000000000',
    createdByName: 'Test User',
    createdDate: '2026-01-01T00:00:00.000Z',
    details: {},
    ignoreWarnings: false,
    lastModifiedDate: '2026-01-01T00:00:00.000Z',
    numberComponentErrors: 0,
    numberComponentsDeployed: 0,
    numberComponentsTotal: 0,
    numberTestErrors: 0,
    numberTestsCompleted: 0,
    numberTestsTotal: 0,
    runTestsEnabled: false,
    rollbackOnError: true,
    ...overrides,
  };
}

describe('DeployResult transport integration', () => {
  it('should return empty async handles by default', () => {
    const result = new DeployResult(createDeployStatus());
    expect(result.getAsyncTransportHandles()).to.have.lengthOf(0);
  });

  it('should include transport file responses in getFileResponses()', () => {
    const result = new DeployResult(createDeployStatus());

    const transportResponses: FileResponse[] = [
      {
        fullName: 'MyApp',
        type: 'PlatformComputeApp',
        state: ComponentStatus.Changed,
        filePath: 'force-app/main/default/compute/MyApp/main.py',
      },
    ];

    result.addTransportResults(transportResponses);

    const fileResponses = result.getFileResponses();
    expect(fileResponses).to.have.lengthOf(1);
    expect(fileResponses[0].fullName).to.equal('MyApp');
  });

  it('should merge transport file responses with metadata file responses', () => {
    const deployStatus = createDeployStatus({
      details: {
        componentSuccesses: {
          changed: 'true',
          created: 'false',
          deleted: 'false',
          fileName: 'classes/MyClass.cls',
          fullName: 'MyClass',
          componentType: 'ApexClass',
          success: 'true',
          createdDate: '2026-01-01',
        },
      },
    });

    const result = new DeployResult(deployStatus);

    const transportResponses: FileResponse[] = [
      {
        fullName: 'MyApp',
        type: 'PlatformComputeApp',
        state: ComponentStatus.Changed,
        filePath: 'force-app/main/default/compute/MyApp/main.py',
      },
    ];

    result.addTransportResults(transportResponses);

    const fileResponses = result.getFileResponses();
    expect(fileResponses).to.have.lengthOf(2);

    const types = fileResponses.map((r) => r.type);
    expect(types).to.include('ApexClass');
    expect(types).to.include('PlatformComputeApp');
  });

  it('should include async transport handles', () => {
    const result = new DeployResult(createDeployStatus());

    const asyncHandle: AsyncTransportHandle = {
      transportName: 'connectApi',
      status: 'Pending',
      message: 'Deploy extension pending',
      checkStatus: async (): Promise<AsyncTransportHandle> => ({
        transportName: 'connectApi',
        status: 'Succeeded' as const,
        checkStatus: async (): Promise<AsyncTransportHandle> => ({} as unknown as AsyncTransportHandle),
      }),
    };

    result.addTransportResults([], [asyncHandle]);

    const handles = result.getAsyncTransportHandles();
    expect(handles).to.have.lengthOf(1);
    expect(handles[0].transportName).to.equal('connectApi');
    expect(handles[0].status).to.equal('Pending');
  });

  it('should invalidate cached responses when transport results are added', () => {
    const result = new DeployResult(createDeployStatus());

    // first call caches
    const initial = result.getFileResponses();
    expect(initial).to.have.lengthOf(0);

    // add transport results
    result.addTransportResults([
      {
        fullName: 'MyApp',
        type: 'PlatformComputeApp',
        state: ComponentStatus.Changed,
        filePath: 'force-app/main/default/compute/MyApp/main.py',
      },
    ]);

    // second call should include transport results
    const updated = result.getFileResponses();
    expect(updated).to.have.lengthOf(1);
  });
});
