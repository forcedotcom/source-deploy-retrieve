const shell = require('shelljs');
require('shelljs/global');

const terminalCodes = {
  FgRed: '\x1b[31m',
  FgWhite: '\x1b[37m',
};

module.exports = {
  run: (status, f) => {
    shell.exec(`printf "🐎 ${status}..."`);
    try {
      f();
    } catch (e) {
      shell.exec(`printf "\\r❗️ ${status}...failed\n"`);
      shell.exec(`printf "${e.message}"`);
      process.exit(1);
    }
    shell.exec(`printf "\\r✅ ${status}...\\033[1m\\033[37mdone\\033[0m\\n"`);
  },
  execSilent: (command, swallowError) => {
    const prevConfig = config.fatal;
    config.fatal = true;
    try {
      return shell.exec(command, { silent: true });
    } catch (e) {
      if (swallowError) {
        return;
      }
      throw e;
    } finally {
      config.fatal = prevConfig;
    }
  },
  terminalCodes,
};
