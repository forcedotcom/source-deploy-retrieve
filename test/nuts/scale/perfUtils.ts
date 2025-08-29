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
import * as path from 'node:path';
import * as os from 'node:os';
import { Performance } from 'node:perf_hooks';
import fs from 'graceful-fs';
import { expect } from 'chai';

export const recordPerf = async (testName: string, performance: Performance): Promise<void> => {
  const fileTarget = path.join(__dirname, 'output.json');
  const existing = fs.existsSync(fileTarget) ? JSON.parse(await fs.promises.readFile(fileTarget, 'utf8')) : [];
  await fs.promises.writeFile(
    fileTarget,
    JSON.stringify(
      existing.concat(
        performance.getEntriesByType('measure').map((m) => ({
          name: `${testName}-${m.name}-${os.platform()}`,
          value: Math.trunc(m.duration),
          unit: 'ms',
        }))
      ),
      null,
      2
    )
  );
  performance.clearMarks();
  performance.clearMeasures();
  expect(fs.existsSync(fileTarget)).to.be.true;
};
