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
          // @ts-expect-error TS doesn't seem to know about the node16 perf hooks :(
          .getEntriesByType('measure')
          .map((m) => ({
            name: `${testName}-${m.name as string}-${os.platform()}`,
            value: Math.trunc(m.duration as number),
            unit: 'ms',
          }))
      ),
      null,
      2
    )
  );
  performance.clearMarks();
  // @ts-expect-error TS doesn't seem to know about the node16 perf hooks :(
  performance.clearMeasures();
  expect(fs.existsSync(fileTarget)).to.be.true;
};
