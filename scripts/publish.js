#!/usr/bin/env node

// eslint-disable-next-line @typescript-eslint/no-var-requires
const shell = require('shelljs');
shell.set('-e');
shell.set('+v');

/*
 * Assumptions:
 * 0. You have shelljs installed globally using `npm install -g shelljs`.
 * 1. The script is running locally and from the top-level directory for this project
 *
 * Instructions:
 * Run this script with LIB_VERSION as environment variables
 * i.e. LIB_VERSION=x.y.z ./scripts/publish.js
 *
 */

const NODE_VERSION = '12.4.0';
const LIB_VERSION = process.env['LIB_VERSION'];

console.log('\nVerifying node version ' + NODE_VERSION + ' is installed.');
const [version, major, minor, patch] = process.version.match(/^v(\d+)\.?(\d+)\.?(\*|\d+)$/);
if (
  parseInt(major) !== parseInt(NODE_VERSION.split('.')[0]) ||
  parseInt(minor) < parseInt(NODE_VERSION.split('.')[1])
) {
  console.log('Please update from node version ' + process.version + ' to ' + NODE_VERSION);
  process.exit(-1);
}

if (!LIB_VERSION) {
  console.log(`You must set environment variable 'LIB_VERSION'.`);
  console.log(`To set: 'export LIB_VERSION=x.y.z'. Where xx.yy.zz is the release number.`);
  process.exit(-1);
}

// Real-clean
console.log('\nClean project');
shell.exec('git clean -xfd -e node_modules');

// Install dependencies
console.log('\nInstall dependencies');
shell.exec('yarn install');

// Bump version
console.log(`\nBump version to ${LIB_VERSION}`);
shell.exec(`yarn version --new-version ${LIB_VERSION} --no-git-tag-version`);

// Build project
console.log('\nBuild project');
shell.exec('yarn build');

// Commit version changes in package.json
console.log('\nGit add package.json');
shell.exec(`git add package.json`);

console.log('\nRunning commit.');
shell.exec(`git commit -m "Updated version"`);

// Create git tag for the release
const gitTagName = `v${LIB_VERSION}`;
console.log(`\nCreating the git tag (e.g. v1.1.0): ${gitTagName}`);
shell.exec(`git tag ${gitTagName}`);

console.log('\nPushing git tag to remote.');
shell.exec(`git push origin ${gitTagName}`);

// Publish library to npm registry
console.log('\nPublishing to npm');
shell.exec(`yarn publish --new-version ${LIB_VERSION}`);

console.log('\nPush package.json changes to repo');
shell.exec(`git push origin main`);
