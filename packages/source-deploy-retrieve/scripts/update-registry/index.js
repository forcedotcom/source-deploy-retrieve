#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const update = require('./update');
const { run, execSilent } = require('../util');

const REGISTRY_PATH = path.join(__dirname, '..', '..', 'src', 'registry', 'registry.json');

function printHelp() {
  const message = `
usage: registry-update apiVersion [-p <describe.json path>] [-u <org username>]

Update the metadata registry db with a new version of the response from a describeMetadata()
call.

A describe response can be provided from a local file using -p, or by querying an org
with a given username using -u. If querying the response from an org, make sure it has been
authenticated to beforehand with the Salesforce CLI.

The update process only adds new entries or modifies existing ones. Please manually review
the changes after they have been generated to ensure there were no unexpected modifications. 
`;
  console.log(message);
}

const [apiVersion, source, sourceArg] = process.argv.slice(2, 5);

let describeResult;

if (source === '-p') {
  const describeFilePath = !path.isAbsolute(sourceArg)
    ? path.resolve(process.cwd(), sourceArg)
    : sourceArg;
  describeResult = JSON.parse(fs.readFileSync(describeFilePath));
} else if (source === '-u') {
  const result = run(`Fetching Metadata API describe for v${apiVersion}`, () =>
    execSilent(`sfdx force:mdapi:describemetadata -u ${sourceArg} -a ${apiVersion} --json`)
  );
  describeResult = JSON.parse(result.stdout).result;
} else {
  printHelp();
  process.exit();
}

run('Applying registry updates', () => {
  const registry = fs.existsSync(REGISTRY_PATH)
    ? JSON.parse(fs.readFileSync(REGISTRY_PATH))
    : { types: {}, suffixes: {}, strictTypeFolder: {} };

  update(registry, describeResult);
  registry.apiVersion = apiVersion;

  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2));
});
