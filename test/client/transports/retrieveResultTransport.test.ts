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
  ComponentSet,
  ComponentStatus,
  FileResponse,
  MetadataApiRetrieveStatus,
  RequestStatus,
  RetrieveResult,
} from '../../../src';

function createRetrieveStatus(overrides: Partial<MetadataApiRetrieveStatus> = {}): MetadataApiRetrieveStatus {
  return {
    id: '09S000000000000',
    status: RequestStatus.Succeeded,
    success: true,
    done: true,
    fileProperties: [],
    zipFile: '',
    ...overrides,
  };
}

describe('RetrieveResult transport integration', () => {
  it('should return empty async handles by default', () => {
    const result = new RetrieveResult(createRetrieveStatus(), new ComponentSet());
    expect(result.getAsyncTransportHandles()).to.have.lengthOf(0);
  });

  it('should include transport file responses in getFileResponses()', () => {
    const result = new RetrieveResult(createRetrieveStatus(), new ComponentSet());

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
    expect(fileResponses[0].type).to.equal('PlatformComputeApp');
  });

  it('should include async transport handles', () => {
    const result = new RetrieveResult(createRetrieveStatus(), new ComponentSet());

    const asyncHandle: AsyncTransportHandle = {
      transportName: 'connectApi',
      status: 'Pending',
      message: 'Retrieve extension pending',
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
    const result = new RetrieveResult(createRetrieveStatus(), new ComponentSet());

    const initial = result.getFileResponses();
    expect(initial).to.have.lengthOf(0);

    result.addTransportResults([
      {
        fullName: 'MyApp',
        type: 'PlatformComputeApp',
        state: ComponentStatus.Changed,
        filePath: 'force-app/main/default/compute/MyApp/main.py',
      },
    ]);

    const updated = result.getFileResponses();
    expect(updated).to.have.lengthOf(1);
  });
});
