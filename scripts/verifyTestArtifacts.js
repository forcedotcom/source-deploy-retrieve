const { existsSync } = require('fs');
const { join } = require('path');
const { terminalCodes } = require('./util');

const { FgRed, FgWhite } = terminalCodes;

const testResultsPath = join(process.cwd(), 'test-results', 'test-results.xml');
if (!existsSync(testResultsPath)) {
  const message = `${FgRed}Test artifacts missing!\nExpected ${testResultsPath} to exist\n\n${FgWhite}The mocha test suite failed to run properly. Possible issues may be circular dependencies or an incompatible dependecy.`;
  console.error(`${FgRed}${message}`);
  process.exit(1);
}
