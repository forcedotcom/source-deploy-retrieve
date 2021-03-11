#!/usr/bin/env node

/*
 * Automates the process of building the change log for releases.
 *
 * Assumption:
 * You have shelljs installed globally using `npm install -g shelljs`.
 *
 * Overriding Default Values:
 * Add verbose logging. Example: npm run build-change-log -- -v
 */

const process = require('process');
const shell = require('shelljs');
const fs = require('fs');
const util = require('util');
const constants = require('./change-log-constants');

shell.set('-e');
shell.set('+v');

// Text Values
const LOG_HEADER = '# %s - Month DD, YYYY\n';
const TYPE_HEADER = '\n## %s\n';
const SECTION_HEADER = '\n#### %s\n';
const MESSAGE_FORMAT =
  '\n- %s ([PR #%s](https://github.com/forcedotcom/salesforcedx-vscode/pull/%s))\n';
const PR_ALREADY_EXISTS_ERROR =
  'Filtered PR number %s. An entry already exists in the changelog.';

// Commit Map Keys
const PR_NUM = 'PR_NUM';
const COMMIT = 'COMMIT';
const TYPE = 'TYPE';
const MESSAGE = 'MESSAGE';

const typesToIgnore = [
  'chore',
  'style',
  'refactor',
  'test',
  'build',
  'ci',
  'revert'
];

function getReleaseVersion() {
    const releaseType = getReleaseType();
    const currentVersion = require('../package.json').version;
    var [version, major, minor, patch] = currentVersion.match(/^(\d+)\.?(\d+)\.?(\*|\d+)$/);
    switch (releaseType) {
      case 'major':
        major = parseInt(major) + 1;
        minor = 0;
        patch = 0;
        break;
      case 'minor':
        minor = parseInt(minor) + 1;
        patch = 0;
        break;
      case 'patch':
        patch = parseInt(patch) + 1;
        break;
    }
    return `${major}.${minor}.${patch}`;
  }

function getNewChangeLogBranch(releaseVersion) {
  if (ADD_VERBOSE_LOGGING) {
    console.log('\nCreate change log branch.');
  }
  const changeLogBranch =
    'changeLog-v' +
    releaseVersion;
  const code = shell.exec(`git checkout -b ${changeLogBranch} main`)
    .code;
  if (code !== 0) {
    console.log('An error occurred generating the change log branch. Exiting.');
    process.exit(-1);
  }
  return changeLogBranch;
}

/**
 * This command will list all commits that are different between
 * the two branches.
 */
function getCommits(releaseBranch, previousBranch) {
  if (ADD_VERBOSE_LOGGING) {
    console.log(
      '\nDetermine differences between develop and main.' +
        '\nCommits:'
    );
  }
  const commits = shell
    .exec(
      `git log --cherry-pick --oneline ${releaseBranch}...${previousBranch}`,
      {
        silent: !ADD_VERBOSE_LOGGING
      }
    )
    .stdout.trim()
    .split('\n');
  return commits;
}

/**
 * Parse the commits and return them as a list of hashmaps.
 */
function parseCommits(commits) {
  if (ADD_VERBOSE_LOGGING) {
    console.log('\nParse commits and gather required information.');
    console.log('Commit Parsing Results...');
  }
  let commitMaps = [];
  for (let i = 0; i < commits.length; i++) {
    const commitMap = buildMapFromCommit(commits[i]);
    if (commitMap && Object.keys(commitMap).length > 0) {
      commitMaps.push(commitMap);
    }
  }
  return filterExistingPREntries(commitMaps);
}

function buildMapFromCommit(commit) {
  let map = {};
  if (commit) {
    let pr = constants.PR_REGEX.exec(commit);
    let commitNum = constants.COMMIT_REGEX.exec(commit);
    if (pr && commitNum) {
      let message = commit.replace(commitNum[0], '').replace(pr[0], '');
      let type = constants.TYPE_REGEX.exec(message);
      map[PR_NUM] = pr[0].replace(/[^\d]/g, '');
      map[COMMIT] = commitNum[0];
      if (type) {
        map[TYPE] = type[1];
        message = message.replace(type[0], '');
      }
      message = message.trim();
      map[MESSAGE] = message.charAt(0).toUpperCase() + message.slice(1);
    }
  }
  if (ADD_VERBOSE_LOGGING) {
    console.log('\nCommit: ' + commit);
    console.log('Commit Map:');
    console.log(map);
  }
  return map;
}

function filterExistingPREntries(parsedCommits) {
  let currentChangeLog = fs.readFileSync(CHANGE_LOG_PATH);
  let filteredResults = [];
  parsedCommits.forEach(function(map) {
    if (!currentChangeLog.includes('PR #' + map[PR_NUM])) {
      filteredResults.push(map);
    } else if (ADD_VERBOSE_LOGGING) {
      console.log('\n' + util.format(PR_ALREADY_EXISTS_ERROR, map[PR_NUM]));
    }
  });
  return filteredResults;
}

function getGroupedMessages(parsedCommits) {
  let groupedMessages = {};
  let sortedMessages = {};
  parsedCommits.forEach(function(map) {
    const key = generateKey('', map[TYPE]);
    if (key) {
        groupedMessages[key] = groupedMessages[key] || [];
        groupedMessages[key].push(
          util.format(MESSAGE_FORMAT, map[MESSAGE], map[PR_NUM], map[PR_NUM])
        );
    }
  });
  Object.keys(groupedMessages)
    .sort()
    .forEach(function(key) {
      sortedMessages[key] = groupedMessages[key];
    });
  if (ADD_VERBOSE_LOGGING) {
    console.log('\nGroup results by type.');
    console.log('Sorted messages by type:');
    console.log(sortedMessages);
  }
  return sortedMessages;
}

/**
 * Generate the key to be used in the grouped messages map. This will help us
 * determine whether this is an addition or fix.
 *
 * If we have a type that should be ignored, return an empty key.
 */
function generateKey(packageName, type) {
  if (
    typesToIgnore.includes(type) ||
    PACKAGES_TO_IGNORE.includes(packageName)
  ) {
    return '';
  }
  const keyPrefix = type === 'feat' ? 'Added' : 'Fixed';
  return `${keyPrefix}|${packageName}`;
}

function getChangeLogText(releaseVersion, groupedMessages) {
  let changeLogText = util.format(
    LOG_HEADER,
    releaseVersion
  );
  let lastType = '';
  Object.keys(groupedMessages).forEach(function(key) {
    let [type, packageName] = key.split('|');
    if (!lastType || lastType != type) {
      changeLogText += util.format(TYPE_HEADER, type);
      lastType = type;
    }
    if (packageName) {
        changeLogText += util.format(SECTION_HEADER, packageName);
    }
    groupedMessages[key].forEach(function(message) {
      changeLogText += message;
    });
  });
  return changeLogText + '\n';
}

function writeChangeLog(textToInsert) {
  let data = fs.readFileSync(CHANGE_LOG_PATH);
  let fd = fs.openSync(CHANGE_LOG_PATH, 'w+');
  let buffer = Buffer.from(textToInsert.toString());
  fs.writeSync(fd, buffer, 0, buffer.length, 0);
  fs.writeSync(fd, data, 0, data.length, buffer.length);
  fs.closeSync(fd);
}

// function openPRForChanges(releaseBranch, changeLogBranch) {
//   const commitCommand = `git commit -a -m "chore: generated CHANGELOG for ${releaseBranch}"`;
//   const pushCommand = `git push origin ${changeLogBranch}`;
//   shell.exec(commitCommand);
//   shell.exec(pushCommand, { silent: true });
//   shell.exec(
//     `open "https://github.com/forcedotcom/salesforcedx-vscode/pull/new/${changeLogBranch}"`
//   );
// }

console.log("Starting script 'change-log-generator'\n");

let ADD_VERBOSE_LOGGING = process.argv.indexOf('-v') > -1 ? true : false;
let CHANGE_LOG_PATH = path.join(process.cwd() + 'CHANGELOG.md');

const releaseVersion = getReleaseVersion();
// console.log(util.format(RELEASE_MESSAGE, releaseVersion, previousBranch));
const changeLogBranch = getNewChangeLogBranch(releaseVersion);

const parsedCommits = parseCommits(getCommits('develop', 'main'));
const groupedMessages = getGroupedMessages(parsedCommits);
const changeLog = getChangeLogText(releaseVersion, groupedMessages);
writeChangeLog(changeLog);
writeAdditionalInfo();
// openPRForChanges(releaseVersion, changeLogBranch);
