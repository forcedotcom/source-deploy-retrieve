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

const getPerfDir = (): string => path.join('test', 'nuts', 'perfResults', `${os.platform()}`);

export const recordPerf = async (testName: string, performance: Performance): Promise<void> => {
  const testPath = getPerfDir();
  const fileTarget = path.join(testPath, `${testName}.json`);

  await fs.promises.mkdir(testPath, { recursive: true });
  expect(fs.existsSync(testPath)).to.be.true;
  await fs.promises.writeFile(
    fileTarget,
    JSON.stringify(
      // TS doesn't seem to know about the node16 perf hooks :(
      // @ts-ignore
      performance.getEntriesByType('measure').map((m) => ({ name: m.name, value: m.duration, unit: 'ms' })),
      null,
      2
    )
  );
  performance.clearMarks();
  expect(fs.existsSync(fileTarget)).to.be.true;
};
