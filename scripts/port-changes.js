#!/usr/bin/env node

const shell = require('shelljs');

// const PR_REGEX = new RegExp(/(\(#\d+\))/);   // works as expected, but doesn't grab all instances.
const PORT_PR_REGEX = new RegExp(/(?:\(#\d+\))\s+(\(#\d+\))$/);  // Grab the second occurance of the PR in the event of a port PR
const COMMIT_REGEX = new RegExp(/^([\da-zA-Z]+)/);
const TYPE_REGEX = new RegExp(/([a-zA-Z]+)(?:\([a-zA-Z]+\))?:/);

const COMMIT = 'COMMIT';
const TYPE = 'TYPE';
const MESSAGE = 'MESSAGE';

function getAllDiffs(baseBranch, featureBranch) {
    if (ADD_VERBOSE_LOGGING)
        console.log(`Step 1: Get all diffs between branches ${baseBranch} and ${featureBranch}`);
    return shell
        .exec(`git log --oneline ${baseBranch}..${featureBranch}`, {
            silent: !ADD_VERBOSE_LOGGING
          })
        .replace(/\n/g, ',')
        .split(',')
        .map(Function.prototype.call, String.prototype.trim);
}

function parseCommits(commits) {
    if (ADD_VERBOSE_LOGGING) {
        console.log('\nStep 2: Parse commits');
        console.log('Commit Parsing Results...');
    }
    var commitMaps = [];
    for (var i = 0; i < commits.length; i++) {
        var commitMap = buildMapFromCommit(commits[i]);
        if (commitMap && Object.keys(commitMap).length > 0) {
            commitMaps.push(commitMap);
        }
    }
    return commitMaps;
}

function buildMapFromCommit(commit) {
    var map = {};
    if (commit) {
        var commitNum = COMMIT_REGEX.exec(commit);
        if (commitNum) {
            var message = commit.replace(commitNum[0], '');
            var portPR = PORT_PR_REGEX.exec(commit);
            if (portPR) {
                message = message.replace(portPR[1], '');
            }
            var type = TYPE_REGEX.exec(message);
            if (type) {
                map[TYPE] = type[1];
                message = message.replace(type[0], '');
            }
            map[COMMIT] = commitNum[0];
            map[MESSAGE] = message.trim();
        }
    }
    if (ADD_VERBOSE_LOGGING) {
        console.log('\nCommit: ' + commit);
        console.log('Commit Map:');
        console.log(map);
    }
    return map;
}

/**
 * From the list of diffs, determine which are 'true' diffs. It's possible for the list
 * to contain entries that have the same commit message, but a different hash. Also,
 * due to porting it's possible for the same commit to be present but with an additional
 * (PR #) appended at the end.
 */
function filterDiffs(parsedCommits) {
    console.log(`\n\nStep 3: Filter out non diffs`);
    var filteredMaps = [];
    for (var i = 0; i < parsedCommits.length; i++) {
        var commitMap = parsedCommits[i];
        if (isTrueDiff(commitMap)) {
            filteredMaps.push(commitMap);
        }
    }
    return filteredMaps;
}

function isTrueDiff(commitMap) {
    var mainResult = shell.exec(`git log --grep="${commitMap[MESSAGE]}" --oneline main`, { silent: true });
    var developResult = shell.exec(`git log --grep="${commitMap[MESSAGE]}" --oneline develop`, { silent: true });
    if (!mainResult || mainResult.length === 0) {
        console.log(`${commitMap[COMMIT]} Commit is missing from main. Porting.`);
        return true;
    } else if (mainResult && developResult) {
        console.log(`${commitMap[COMMIT]} Commit is present in both branches. Filtering.`);
        return false;
    }
}

let ADD_VERBOSE_LOGGING = process.argv.indexOf('-v') > -1 ? true : false;

const diffList = getAllDiffs('main', 'develop');
const parsedCommits = parseCommits(diffList);
const filteredDiffList = filterDiffs(parsedCommits);
console.log('\nFinal Results:');
console.log(filteredDiffList);

// # 3 - maybe this step can actually come later?
// # Generate a new branch for the port.
// # TODO - what should the version be. Or could we just use today's date?

// # 4
// # cherry-pick all commits that are true diffs.