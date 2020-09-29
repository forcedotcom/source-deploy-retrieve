#!/usr/bin/env node

const repl = require('repl');
const { Connection, AuthInfo } = require('@salesforce/core');
const { RegistryAccess, MetadataConverter, SourceClient } = require('../lib/src');

const startMessage = `
Usage:
  registryAccess: RegistryAccess instance
  converter: MetadataConverter instance
  resolve(path): resolve components from a path
  async client(username): create a SourceClient
`
console.log(startMessage);

const replServer = repl.start({ breakEvalOnSigint: true });
replServer.setupHistory('.repl_history', (err, repl) => {});
replServer.context.registryAccess = new RegistryAccess();
replServer.context.converter = new MetadataConverter();
replServer.context.resolve = (path) => replServer.context.registryAccess.getComponentsFromPath(path)
replServer.context.client = async (username) => {
  return new SourceClient(await Connection.create({
    authInfo: await AuthInfo.create({ username })
  }));
}
