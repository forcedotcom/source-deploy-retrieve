#!/usr/bin/env node

const { execSilent } = require('./util');

const MAX_ATTEMPTS = 3;
const COVERAGE_RESULTS = 'test-results/coverage/lcov.info';

let attempts = 0;
do {
  try {
    const result = execSilent(`curl -s https://codecov.io/bash | bash -s -- -f ${COVERAGE_RESULTS}`);
    console.log(result.stdout);
    break;
  } catch (e) {
    attempts += 1;
    let message = `Failed to publish coverage results on attempt ${attempts}`;
    if (attempts < MAX_ATTEMPTS) {
      message += ' - trying again...';
    }
    console.log(message);
    console.log(e.message)
  }
} while (attempts < MAX_ATTEMPTS);
