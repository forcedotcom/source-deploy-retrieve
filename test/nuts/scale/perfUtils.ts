/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as path from 'path';
import * as os from 'os';
import { Performance } from 'node:perf_hooks';
import * as fs from 'graceful-fs';
import { expect } from 'chai';

export const recordPerf = async (testName: string, performance: Performance): Promise<void> => {
  const fileTarget = path.join(__dirname, 'output.json');
  const existing = fs.existsSync(fileTarget) ? JSON.parse(await fs.promises.readFile(fileTarget, 'utf8')) : [];
  await fs.promises.writeFile(
    fileTarget,
    JSON.stringify(
      existing.concat(
        performance
          .getEntriesByType('measure')
          // TODO: remove this when we upgrade to node16 and get its types
          .map((m: { name: string; duration: number }) => ({
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
