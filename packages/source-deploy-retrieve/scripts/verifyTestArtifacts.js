#!/usr/bin/env node

const { existsSync } = require('fs');
const { join } = require('path');
const { Red } = require('./util').terminalCodes;

const testResultsPath = join(__dirname, '..', 'test-results', 'test-results.xml');

if (!existsSync(testResultsPath)) {
  let message = `\nTest artifacts missing!\n\n`;
  message += `Expected ${testResultsPath} to exist.\n\n`;
  message += `The mocha test suite probably panicked and failed silently. Unfortunately the reason is unknown and you may need to retrace your steps to resolve the issue.\n`;
  console.error(`${Red}${message}`);
  process.exit(1);
}
