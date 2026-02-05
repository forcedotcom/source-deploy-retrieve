const shell = require('shelljs');
require('shelljs/global');

const terminalCodes = {
  Red: '\\033[31m',
  LightGrey: '\\033[37m',
  Bold: '\\033[1m',
  ResetAll: '\\033[0m',
};

module.exports = {
  run: (status, f) => {
    let result;
    shell.exec(`printf "🐎 ${status}..."`);
    const { LightGrey, Bold, ResetAll } = terminalCodes;
    try {
      result = f();
    } catch (e) {
      shell.exec(`printf "\\r❗️ ${status}...${Bold}${LightGrey}failed${ResetAll}\\n"`);
      shell.exec(`printf "${e.message}"`);
      process.exit(1);
    }
    shell.exec(`printf "\\r✅ ${status}...${Bold}${LightGrey}done${ResetAll}\\n"`);
    return result;
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
