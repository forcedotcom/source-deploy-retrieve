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
import JSZip from 'jszip';

// eslint-disable-next-line @typescript-eslint/require-await
export async function createMockZip(entries: string[]): Promise<Buffer> {
  const zip = JSZip();
  for (const entry of entries) {
    // Ensure only posix paths are added to zip files
    const relPosixPath = entry.replace(/\\/g, '/');
    zip.file(relPosixPath, '');
  }
  return zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  });
}
