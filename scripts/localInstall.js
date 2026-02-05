#!/usr/bin/env node

const shell = require('shelljs');
const fs = require('fs');
const path = require('path');
const { run, execSilent } = require('./util');

/**
 * Script for setting up the library in another local project
 *
 * ### Usage
 *
 * 1) `./localInstall install /path/to/target`
 *
 * Generate and install a tarball package to a target npm module. Useful for locally
 * testing a build that will be sent to NPM. Accepts a relative or absolute path.
 *
 * 2) `./localInstall.js link /path/to/target`.
 *
 * Link the library to another project for development purposes. Changes made in this
 * project will be automatically reflected in the target module.
 *
 * 3) `./localInstall.js unlink /path/to/target`
 *
 * Unlink the library from another project.
 */

const COMMANDS = ['install', 'link', 'unlink'];

function showHelp() {
  console.log('Commands:');
  console.log(
    '  install [path to target module]\tCreates an NPM package of the project and installs it to the target module'
  );
  console.log('  link [path to target module]\t\tLink the project to another module for quick development');
  console.log('  unlink [path to target module]\tUnlink the project from the target module');
}

function main() {
  const command = process.argv[2];
  if (!COMMANDS.includes(command)) {
    showHelp();
    process.exit(0);
  }

  const targetPackagePath = !path.isAbsolute(process.argv[3])
    ? path.resolve(process.cwd(), process.argv[3])
    : process.argv[3];

  if (!fs.existsSync(targetPackagePath)) {
    console.log(`A valid target package path is required`);
    process.exit(1);
  }

  const isDirectory = fs.lstatSync(targetPackagePath).isDirectory();
  const packageJsonPath = path.join(targetPackagePath, 'package.json');
  if (!isDirectory || !fs.existsSync(packageJsonPath)) {
    console.log('Path must be to a valid npm package');
    process.exit(1);
  }

  const localPackagePath = path.join(__dirname, '..');
  const { name, version } = JSON.parse(fs.readFileSync(path.join(localPackagePath, 'package.json')).toString());

  switch (command) {
    case COMMANDS[0]: // install
      let tarballPath;
      run('Building project and creating package', () => {
        shell.cd(localPackagePath);
        execSilent('yarn build');
        execSilent('yarn pack');
        tarballPath = execSilent('find $(pwd) -type f -iname *.tgz').replace('\n', '');
      });

      run(`Installing v${version} to ${targetPackagePath}`, () => {
        shell.cd(targetPackagePath);
        const yarnLockPath = path.join(targetPackagePath, 'yarn.lock');
        if (fs.existsSync(yarnLockPath)) {
          execSilent(`yarn remove ${name}`, true);
          execSilent(`yarn cache clean`);
          execSilent(`yarn add ${tarballPath}`);
        } else {
          execSilent(`npm uninstall ${name}`);
          execSilent(`npm install ${tarballPath}`);
        }
      });
      break;
    case COMMANDS[1]: // link
      run(`Linking ${name} to ${targetPackagePath}`, () => {
        shell.cd(localPackagePath);
        execSilent('yarn link');
        shell.cd(targetPackagePath);
        execSilent(`yarn link ${name}`);
      });
      break;
    case COMMANDS[2]: // unlink
      run(`Unlinking ${name} from ${targetPackagePath}`, () => {
        shell.cd(targetPackagePath);
        execSilent(`yarn unlink ${name}`);
        shell.cd(localPackagePath);
        execSilent('yarn unlink');
      });
      break;
    default:
      showHelp();
  }
}

main();
