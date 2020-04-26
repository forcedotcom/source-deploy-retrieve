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
 * 1) `yarn local:install /path/to/module`
 *
 * Generate and install a tarball package and installs it to a local npm module. Useful for
 * locally testing a build that will be sent to NPM. Accepts a relative or absolute
 * path.
 *
 * 2) `yarn local:link /path/to/target`.
 *
 * Link the library to another project for development purposes. Changes made in this
 * project will be automatically reflected in the target module.
 *
 * 3) `yarn local:unlink /path/to/target`
 *
 * Unlink the library from another project.
 */
function main() {
  console.log();
  let targetPackagePath = process.argv[3];

  if (!fs.existsSync(targetPackagePath)) {
    console.log(`${targetPackagePath} does not exist`);
    process.exit(1);
  }

  const isDirectory = fs.lstatSync(targetPackagePath).isDirectory();
  const packageJsonPath = path.join(targetPackagePath, 'package.json');
  if (!isDirectory || !fs.existsSync(packageJsonPath)) {
    console.log('Path must be to a valid npm package');
    process.exit(1);
  }

  if (!path.isAbsolute(targetPackagePath)) {
    targetPackagePath = path.resolve(process.cwd(), targetPackagePath);
  }

  const command = process.argv[2];
  const localPackagePath = path.join(__dirname, '..');
  const { name, version } = JSON.parse(
    fs.readFileSync(path.join(localPackagePath, 'package.json')).toString()
  );

  if (command === 'install') {
    let tarballPath;
    run('Building project and creating package', () => {
      shell.cd(localPackagePath);
      execSilent('yarn build');
      execSilent('yarn pack');
      tarballPath = execSilent('find $(pwd) -type f -iname *.tgz').replace(
        '\n',
        ''
      );
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
  } else if (command === 'unlink') {
    run(`Unlinking ${name} from ${targetPackagePath}`, () => {
      shell.cd(targetPackagePath);
      execSilent(`yarn unlink ${name}`);
      shell.cd(localPackagePath);
      execSilent('yarn unlink');
    });
  } else {
    run(`Linking ${name} to ${targetPackagePath}`, () => {
      shell.cd(localPackagePath);
      execSilent('yarn link');
      shell.cd(targetPackagePath);
      execSilent(`yarn link ${name}`);
    });
  }
  console.log();
}

main();
