#!/usr/bin/env node

const shell = require('shelljs');

const PR_REGEX = new RegExp(/(\(#\d+\))(\s+\(#\d+\))*$/);
const COMMIT_REGEX = new RegExp(/^([\da-zA-Z]+)/);
const TYPE_REGEX = new RegExp(/([a-zA-Z]+)(?:\([a-zA-Z]+\))?:/);
const RELEASE_REGEX = new RegExp(/^\d{1,2}\.\d{1,2}\.\d/);

const PR_NUM = 'PR_NUM';
const COMMIT = 'COMMIT';
const TYPE = 'TYPE';
const MESSAGE = 'MESSAGE';

function getAllDiffs(baseBranch, featureBranch) {
    if (ADD_VERBOSE_LOGGING)
        console.log(`\n\nStep 1: Get all diffs between branches ${baseBranch} and ${featureBranch}`);
    shell.exec(`git fetch upstream main:main`, { silent: !ADD_VERBOSE_LOGGING });
    shell.exec(`git fetch upstream develop:develop`, { silent: !ADD_VERBOSE_LOGGING });
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
        console.log('\n\nStep 2: Parse commits');
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
            var pr = PR_REGEX.exec(commit);
            if (pr) {
                map[PR_NUM] = pr[0];
                message = message.replace(pr[0], '');
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
    if (ADD_VERBOSE_LOGGING) {
        console.log(`\n\nStep 3: Filter out non diffs. The commits we would want to filter...`);
        console.log('\ta) Are the same, but have a different hash.');
        console.log('\tb) Were ported from one branch to another. Therefore, they include an additional (PR #).\n');
    }
    var filteredMaps = [];
    for (var i = 0; i < parsedCommits.length; i++) {
        var commitMap = parsedCommits[i];
        if (isTrueDiff(commitMap)) {
            filteredMaps.push(commitMap);
        }
    }
    if (ADD_VERBOSE_LOGGING) {
        console.log('\nFiltered Results were: ');
        console.log(filteredMaps);
    }
    return filteredMaps;
}

function isTrueDiff(commitMap) {
    var mainResult = shell.exec(`git log --grep="${commitMap[MESSAGE]}" --oneline main`, { silent: true });
    var developResult = shell.exec(`git log --grep="${commitMap[MESSAGE]}" --oneline develop`, { silent: true });
    if (!mainResult || mainResult.length === 0) {
        if (ADD_VERBOSE_LOGGING)
            console.log(`Commit is missing from main. Porting.\n\t${commitMap[COMMIT]} ${commitMap[MESSAGE]}`);
        return true;
    } else if (mainResult && developResult) {
        if (ADD_VERBOSE_LOGGING)
            console.log(`Commit is present in both branches. Filtering.\n\t${commitMap[COMMIT]} ${commitMap[MESSAGE]}`);
        return false;
    }
}

function getPortBranch() {
    if (ADD_VERBOSE_LOGGING)
        console.log('\n\nStep 4: Generate the port PR branch based on -r argument');
    var releaseIndex = process.argv.indexOf('-r');
    if (!(releaseIndex > -1)) {
        console.error('Release version for the port PR is required. Example: \'-r 0.0.5\'');
        process.exit(-1);
    }
    if (!RELEASE_REGEX.exec(`${process.argv[releaseIndex + 1]}`)) {
        console.error(
            `Invalid release version '${process.argv[releaseIndex + 1]}'. Expected format [x.y.z].`
        );
        process.exit(-1);
    }
    shell.exec(`git checkout -b portPR-v${process.argv[releaseIndex + 1]} main`);
}

function getCherryPickCommits(diffList) {
    if (ADD_VERBOSE_LOGGING)
        console.log('\n\nStep 5: Cherry-pick diffs into new branch');
    for (var i = diffList.length - 1; i >= 0; i--) {
        shell.exec(`git cherry-pick --strategy=recursive -X theirs ${diffList[i][COMMIT]}`);
    }
}

let ADD_VERBOSE_LOGGING = process.argv.indexOf('-v') > -1 ? true : false;

const diffList = getAllDiffs('main', 'develop');
const parsedCommits = parseCommits(diffList);
const filteredDiffList = filterDiffs(parsedCommits);
getPortBranch();
getCherryPickCommits(filteredDiffList);
