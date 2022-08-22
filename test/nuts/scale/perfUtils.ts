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

const getPerfDir = (): string =>
  path
    .join('test', 'nuts', 'perfResults', `${os.arch()}-${os.platform()}-${os.cpus().length}x${os.cpus()[0].model}`)
    .replace(/@/g, '')
    .replace(/\(R\)/g, '')
    .replace(/\(TM\)/g, '')
    .replace(/\./g, '-')
    .replace(/\s/g, '-');

export const recordPerf = async (testName: string, performance: Performance): Promise<void> => {
  const testPath = getPerfDir();
  const fileTarget = path.join(testPath, `${testName}.json`);

  // eslint-disable-next-line no-console
  console.log(`will save results to ${testPath}`);
  await fs.promises.mkdir(testPath, { recursive: true });
  await fs.promises.writeFile(
    fileTarget,
    JSON.stringify(
      // TS doesn't seem to know about the node16 perf hooks :(
      // @ts-ignore
      performance.getEntriesByType('measure').map((m) => ({ name: m.name, duration: m.duration })),
      null,
      2
    )
  );
  // eslint-disable-next-line no-console
  console.log(`file exists: ${fs.existsSync(fileTarget)}`);
  // eslint-disable-next-line no-console
  console.log(await fs.promises.readFile(fileTarget));
  performance.clearMarks();
};
