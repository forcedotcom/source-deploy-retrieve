const { existsSync } = require('fs');
const { join } = require('path');
const { terminalCodes } = require('./util');
const { FgRed, FgWhite } = terminalCodes;

const testResultsPath = join(process.cwd(), 'test-results', 'test-results.xml');

if (!existsSync(testResultsPath)) {
  const message = `${FgRed}Test artifacts missing! Expected ${testResultsPath} to exist. The mocha test suite failed to run properly - Possible issues may be circular dependencies or an incompatible dependency.`;
  console.error(`${FgRed}${message}`);
  process.exit(1);
}
