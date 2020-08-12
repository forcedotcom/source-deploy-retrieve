#!/usr/bin/env node

const { execSilent } = require('./util');

/**
 * Script for publishing code coverage results to Codecov.io. Intended to run
 * during a CircleCI job.
 *
 * Not using path.join for the path to coverage report because in the Windows job,
 * this script runs with bash.exe to allow running the codecov.io publish script.
 * Hence using a Windows formatted path will confuse the process.
 */

const MAX_ATTEMPTS = 3;

let attempts = 0;

do {
  try {
    const result = execSilent('curl -s https://codecov.io/bash | bash -s -- -f test-results/coverage/lcov.info');
    console.log(result.stdout);
    break;
  } catch (e) {
    attempts += 1;
    let message = `Failed to publish coverage results on attempt ${attempts}`;
    if (attempts < MAX_ATTEMPTS) {
      message += ' - trying again...';
    }
    console.log(message);
    console.log(e.message);
  }
} while (attempts < MAX_ATTEMPTS);
