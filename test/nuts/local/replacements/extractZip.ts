/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as JSZip from 'jszip';

export const extractZip = async (zipBuffer: Buffer, extractPath: string) => {
  fs.mkdirSync(extractPath);
  const zip = await JSZip.loadAsync(zipBuffer);
  for (const filePath of Object.keys(zip.files)) {
    const zipObj = zip.file(filePath);
    if (!zipObj || zipObj?.dir) {
      fs.mkdirSync(path.join(extractPath, filePath));
    } else {
      // eslint-disable-next-line no-await-in-loop
      const content = await zipObj?.async('nodebuffer');
      if (content) {
        fs.writeFileSync(path.join(extractPath, filePath), content);
      }
    }
  }
};
