/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as os from 'os';
import { Performance } from 'node:perf_hooks';
import * as fs from 'graceful-fs';
import { expect } from 'chai';

const getPerfDir = (): string => ['test', 'nuts', 'perfResults'].join('/');

export const recordPerf = async (testName: string, performance: Performance): Promise<void> => {
  const testPath = getPerfDir();
  const fileTarget = [testPath, 'output.json'].join('/');

  // eslint-disable-next-line no-console
  console.log(`writing file to ${fileTarget}`);
  await fs.promises.mkdir(testPath, { recursive: true });
  expect(fs.existsSync(testPath)).to.be.true;
  const existing = fs.existsSync(fileTarget) ? JSON.parse(await fs.promises.readFile(fileTarget, 'utf8')) : [];
  await fs.promises.writeFile(
    fileTarget,
    JSON.stringify(
      existing.concat(
        performance
          // TS doesn't seem to know about the node16 perf hooks :(
          // @ts-ignore
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
  expect(fs.existsSync(fileTarget)).to.be.true;
};
