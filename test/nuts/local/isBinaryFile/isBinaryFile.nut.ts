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
import * as fs from 'node:fs';
import { TestSession } from '@salesforce/cli-plugins-testkit';
import { expect } from 'chai';
import { isBinaryFileSync } from '../../../../src/convert/isBinaryFile';

describe('isBinaryFileSync nut test', () => {
  let session: TestSession;

  before(async () => {
    session = await TestSession.create({
      project: {
        name: 'isBinaryFileNut',
      },
      devhubAuthStrategy: 'NONE',
    });
  });

  after(async () => {
    await session?.clean();
  });

  describe('text files', () => {
    it('identifies plain text files as non-binary', () => {
      const textFile = path.join(session.project.dir, 'text.txt');
      fs.writeFileSync(textFile, 'This is a plain text file with some content.');

      expect(isBinaryFileSync(textFile)).to.be.false;
    });

    it('identifies JavaScript files as non-binary', () => {
      const jsFile = path.join(session.project.dir, 'script.js');
      fs.writeFileSync(jsFile, 'console.log("Hello, World!");\nconst x = 42;');

      expect(isBinaryFileSync(jsFile)).to.be.false;
    });

    it('identifies TypeScript files as non-binary', () => {
      const tsFile = path.join(session.project.dir, 'component.ts');
      fs.writeFileSync(tsFile, 'export class MyComponent {\n  private name: string;\n}');

      expect(isBinaryFileSync(tsFile)).to.be.false;
    });

    it('identifies JSON files as non-binary', () => {
      const jsonFile = path.join(session.project.dir, 'config.json');
      fs.writeFileSync(jsonFile, '{"name": "test", "version": "1.0.0"}');

      expect(isBinaryFileSync(jsonFile)).to.be.false;
    });

    it('identifies XML files as non-binary', () => {
      const xmlFile = path.join(session.project.dir, 'manifest.xml');
      fs.writeFileSync(
        xmlFile,
        '<?xml version="1.0"?>\n<Package xmlns="http://soap.sforce.com/2006/04/metadata">\n</Package>'
      );

      expect(isBinaryFileSync(xmlFile)).to.be.false;
    });

    it('identifies files with UTF-8 BOM as non-binary', () => {
      const utf8BomFile = path.join(session.project.dir, 'utf8-bom.txt');
      const bom = Buffer.from([0xef, 0xbb, 0xbf]);
      const content = Buffer.from('Text with UTF-8 BOM');
      fs.writeFileSync(utf8BomFile, Buffer.concat([bom, content]));

      expect(isBinaryFileSync(utf8BomFile)).to.be.false;
    });

    it('identifies files with UTF-16 BOM as non-binary', () => {
      const utf16BeFile = path.join(session.project.dir, 'utf16-be.txt');
      const bom = Buffer.from([0xfe, 0xff]);
      const content = Buffer.from('Text with UTF-16 BE BOM');
      const utf16Content = Buffer.alloc(content.length * 2);
      for (let i = 0; i < content.length; i++) {
        utf16Content[i * 2] = 0x00; // high byte
        utf16Content[i * 2 + 1] = content[i]; // low byte
      }
      fs.writeFileSync(utf16BeFile, Buffer.concat([bom, utf16Content]));

      expect(isBinaryFileSync(utf16BeFile)).to.be.false;
    });

    it('identifies empty files as non-binary', () => {
      const emptyFile = path.join(session.project.dir, 'empty.txt');
      fs.writeFileSync(emptyFile, '');

      expect(isBinaryFileSync(emptyFile)).to.be.false;
    });
  });

  describe('binary files', () => {
    it('identifies files with null bytes as binary', () => {
      const nullByteFile = path.join(session.project.dir, 'null-bytes.bin');
      const content = Buffer.from([0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x00, 0x57, 0x6f, 0x72, 0x6c, 0x64]); // "Hello\0World"
      fs.writeFileSync(nullByteFile, content);

      expect(isBinaryFileSync(nullByteFile)).to.be.true;
    });

    it('identifies PDF files as binary', () => {
      const pdfFile = path.join(session.project.dir, 'test.pdf');
      const pdfHeader = Buffer.from('%PDF-1.4\n%âãÏÓ\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n');
      fs.writeFileSync(pdfFile, pdfHeader);

      expect(isBinaryFileSync(pdfFile)).to.be.true;
    });

    it('identifies files with high percentage of non-printable characters as binary', () => {
      const binaryFile = path.join(session.project.dir, 'binary-data.bin');
      const content = Buffer.from([
        0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f, 0x10, 0x11,
        0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x1b, 0x1c, 0x1d, 0x1e, 0x1f, 0x20, 0x21, 0x22, 0x23,
        0x24, 0x25, 0x26, 0x27, 0x28, 0x29, 0x2a, 0x2b, 0x2c, 0x2d, 0x2e, 0x2f, 0x30, 0x31, 0x32, 0x33, 0x34, 0x35,
        0x36, 0x37, 0x38, 0x39, 0x3a, 0x3b, 0x3c, 0x3d, 0x3e, 0x3f, 0x40, 0x41, 0x42, 0x43, 0x44, 0x45, 0x46, 0x47,
        0x48, 0x49, 0x4a, 0x4b, 0x4c, 0x4d, 0x4e, 0x4f, 0x50, 0x51, 0x52, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59,
        0x5a, 0x5b, 0x5c, 0x5d, 0x5e, 0x5f, 0x60, 0x61, 0x62, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6a, 0x6b,
        0x6c, 0x6d, 0x6e, 0x6f, 0x70, 0x71, 0x72, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7a, 0x7b, 0x7c, 0x7d,
        0x7e, 0x7f, 0x80, 0x81, 0x82, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89, 0x8a, 0x8b, 0x8c, 0x8d, 0x8e, 0x8f,
        0x90, 0x91, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9a, 0x9b, 0x9c, 0x9d, 0x9e, 0x9f, 0xa0, 0xa1,
        0xa2, 0xa3, 0xa4, 0xa5, 0xa6, 0xa7, 0xa8, 0xa9, 0xaa, 0xab, 0xac, 0xad, 0xae, 0xaf, 0xb0, 0xb1, 0xb2, 0xb3,
        0xb4, 0xb5, 0xb6, 0xb7, 0xb8, 0xb9, 0xba, 0xbb, 0xbc, 0xbd, 0xbe, 0xbf, 0xc0, 0xc1, 0xc2, 0xc3, 0xc4, 0xc5,
        0xc6, 0xc7, 0xc8, 0xc9, 0xca, 0xcb, 0xcc, 0xcd, 0xce, 0xcf, 0xd0, 0xd1, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7,
        0xd8, 0xd9, 0xda, 0xdb, 0xdc, 0xdd, 0xde, 0xdf, 0xe0, 0xe1, 0xe2, 0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9,
        0xea, 0xeb, 0xec, 0xed, 0xee, 0xef,
      ]);
      fs.writeFileSync(binaryFile, content);

      expect(isBinaryFileSync(binaryFile)).to.be.true;
    });

    it('identifies protobuf files as binary', () => {
      const protoFile = path.join(session.project.dir, 'test.proto');
      // Create a simple protobuf-like binary content
      const protoContent = Buffer.from([
        0x08,
        0x01, // field 1, wire type 0, value 1
        0x12,
        0x07, // field 2, wire type 2, length 7
        0x74,
        0x65,
        0x73,
        0x74,
        0x69,
        0x6e,
        0x67, // "testing"
      ]);
      fs.writeFileSync(protoFile, protoContent);

      expect(isBinaryFileSync(protoFile)).to.be.true;
    });
  });

  describe('edge cases', () => {
    it('throws error for non-existent files', () => {
      const nonExistentFile = path.join(session.project.dir, 'does-not-exist.txt');

      expect(() => isBinaryFileSync(nonExistentFile)).to.throw();
    });

    it('throws error for directories', () => {
      const dirPath = path.join(session.project.dir, 'test-dir');
      fs.mkdirSync(dirPath, { recursive: true });

      expect(() => isBinaryFileSync(dirPath)).to.throw('Path provided was not a file!');
    });

    it('handles files with mixed content', () => {
      const mixedFile = path.join(session.project.dir, 'mixed.txt');
      const textContent = 'This is some text content';
      const binaryContent = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05]);
      const mixedContent = Buffer.concat([Buffer.from(textContent), binaryContent]);
      fs.writeFileSync(mixedFile, mixedContent);

      expect(isBinaryFileSync(mixedFile)).to.be.true;
    });

    it('handles files with control characters but still text', () => {
      const controlCharFile = path.join(session.project.dir, 'control-chars.txt');
      const content = 'Line 1\nLine 2\r\nLine 3\tTabbed content';
      fs.writeFileSync(controlCharFile, content);

      expect(isBinaryFileSync(controlCharFile)).to.be.false;
    });
  });
});
