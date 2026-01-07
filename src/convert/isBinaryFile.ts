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

// simplified version of https://github.com/gjtorikian/isBinaryFile

/*
 original copyright notice from https://github.com/gjtorikian/isBinaryFile/commit/123cce905590766d092c47e034163b03e47d5044#diff-d0ed4cc3fb70489fe51c7e0ac180cba2a7472124f9f9e9ae67b01a37fbd580b7
 Copyright (c) 2019 Garen J. Torikian
 
MIT License
 
Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:
 
The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.
 
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF  
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 
 */

import * as fs from 'node:fs';

const MAX_BYTES = 512;

// A very basic non-exception raising reader. Read bytes and
// at the end use hasError() to check whether this worked.
class Reader {
  public offset: number;
  public error: boolean;

  public constructor(public fileBuffer: Buffer, public size: number) {
    this.offset = 0;
    this.error = false;
  }

  public hasError(): boolean {
    return this.error;
  }

  public nextByte(): number {
    if (this.offset === this.size || this.hasError()) {
      this.error = true;
      return 0xff;
    }
    return this.fileBuffer[this.offset++];
  }

  public next(len: number): number[] {
    const n = [];
    for (let i = 0; i < len; i++) {
      n[i] = this.nextByte();
    }
    return n;
  }
}

// Read a Google Protobuf var(iable)int from the buffer.
function readProtoVarInt(reader: Reader): number {
  let idx = 0;
  let varInt = 0;

  while (!reader.hasError()) {
    const b = reader.nextByte();
    varInt = varInt | ((b & 0x7f) << (7 * idx));
    if ((b & 0x80) === 0) {
      break;
    }
    idx++;
  }

  return varInt;
}

// Attempt to taste a full Google Protobuf message.
function readProtoMessage(reader: Reader): boolean {
  const varInt = readProtoVarInt(reader);
  const wireType = varInt & 0x7;

  switch (wireType) {
    case 0:
      readProtoVarInt(reader);
      return true;
    case 1:
      reader.next(8);
      return true;
    case 2: {
      const len = readProtoVarInt(reader);
      reader.next(len);
      return true;
    }
    case 5:
      reader.next(4);
      return true;
  }
  return false;
}

// Check whether this seems to be a valid protobuf file.
function isBinaryProto(fileBuffer: Buffer, totalBytes: number): boolean {
  const reader = new Reader(fileBuffer, totalBytes);
  let numMessages = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    // Definitely not a valid protobuf
    if (!readProtoMessage(reader) && !reader.hasError()) {
      return false;
    }
    // Short read?
    if (reader.hasError()) {
      break;
    }
    numMessages++;
  }

  return numMessages > 0;
}

export function isBinaryFileSync(file: string): boolean {
  const stat = fs.statSync(file);

  isStatFile(stat);

  const fileDescriptor = fs.openSync(file, 'r');

  const allocBuffer = Buffer.alloc(MAX_BYTES);

  const bytesRead = fs.readSync(fileDescriptor, allocBuffer, 0, MAX_BYTES, 0);
  fs.closeSync(fileDescriptor);

  return isBinaryCheck(allocBuffer, bytesRead);
}

// eslint-disable-next-line complexity
function isBinaryCheck(fileBuffer: Buffer, bytesRead: number): boolean {
  // empty file. no clue what it is.
  if (bytesRead === 0) {
    return false;
  }

  let suspiciousBytes = 0;
  const totalBytes = Math.min(bytesRead, MAX_BYTES);

  // UTF-8 BOM
  if (bytesRead >= 3 && fileBuffer[0] === 0xef && fileBuffer[1] === 0xbb && fileBuffer[2] === 0xbf) {
    return false;
  }

  // UTF-32 BOM
  if (
    bytesRead >= 4 &&
    fileBuffer[0] === 0x00 &&
    fileBuffer[1] === 0x00 &&
    fileBuffer[2] === 0xfe &&
    fileBuffer[3] === 0xff
  ) {
    return false;
  }

  // UTF-32 LE BOM
  if (
    bytesRead >= 4 &&
    fileBuffer[0] === 0xff &&
    fileBuffer[1] === 0xfe &&
    fileBuffer[2] === 0x00 &&
    fileBuffer[3] === 0x00
  ) {
    return false;
  }

  // GB BOM
  if (
    bytesRead >= 4 &&
    fileBuffer[0] === 0x84 &&
    fileBuffer[1] === 0x31 &&
    fileBuffer[2] === 0x95 &&
    fileBuffer[3] === 0x33
  ) {
    return false;
  }

  if (totalBytes >= 5 && fileBuffer.slice(0, 5).toString() === '%PDF-') {
    /* PDF. This is binary.*/
    return true;
  }

  // UTF-16 BE BOM
  if (bytesRead >= 2 && fileBuffer[0] === 0xfe && fileBuffer[1] === 0xff) {
    return false;
  }

  // UTF-16 LE BOM
  if (bytesRead >= 2 && fileBuffer[0] === 0xff && fileBuffer[1] === 0xfe) {
    return false;
  }

  for (let i = 0; i < totalBytes; i++) {
    if (fileBuffer[i] === 0) {
      // NULL byte--it's binary!
      return true;
    } else if ((fileBuffer[i] < 7 || fileBuffer[i] > 14) && (fileBuffer[i] < 32 || fileBuffer[i] > 127)) {
      // UTF-8 detection
      if (fileBuffer[i] >= 0xc0 && fileBuffer[i] <= 0xdf && i + 1 < totalBytes) {
        i++;
        if (fileBuffer[i] >= 0x80 && fileBuffer[i] <= 0xbf) {
          continue;
        }
      } else if (fileBuffer[i] >= 0xe0 && fileBuffer[i] <= 0xef && i + 2 < totalBytes) {
        i++;
        if (fileBuffer[i] >= 0x80 && fileBuffer[i] <= 0xbf && fileBuffer[i + 1] >= 0x80 && fileBuffer[i + 1] <= 0xbf) {
          i++;
          continue;
        }
      } else if (fileBuffer[i] >= 0xf0 && fileBuffer[i] <= 0xf7 && i + 3 < totalBytes) {
        i++;
        if (
          fileBuffer[i] >= 0x80 &&
          fileBuffer[i] <= 0xbf &&
          fileBuffer[i + 1] >= 0x80 &&
          fileBuffer[i + 1] <= 0xbf &&
          fileBuffer[i + 2] >= 0x80 &&
          fileBuffer[i + 2] <= 0xbf
        ) {
          i += 2;
          continue;
        }
      }

      suspiciousBytes++;
      // Read at least 32 fileBuffer before making a decision
      if (i >= 32 && (suspiciousBytes * 100) / totalBytes > 10) {
        return true;
      }
    }
  }

  if ((suspiciousBytes * 100) / totalBytes > 10) {
    return true;
  }

  if (suspiciousBytes > 1 && isBinaryProto(fileBuffer, totalBytes)) {
    return true;
  }

  return false;
}

function isStatFile(stat: fs.Stats): void {
  if (!stat.isFile()) {
    throw new Error('Path provided was not a file!');
  }
}
