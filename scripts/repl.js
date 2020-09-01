#!/usr/bin/env node

const repl = require('repl');
const { RegistryAccess, MetadataConverter } = require('../lib/src');

const startMessage = `
Usage:
  registryAccess: RegistryAccess instance
  converter: MetadataConverter instance
  resolve(path): resolve components from a path
`
console.log(startMessage);

const replServer = repl.start({ breakEvalOnSigint: true });
replServer.setupHistory('.repl_history', (err, repl) => {});
replServer.context.registryAccess = new RegistryAccess();
replServer.context.converter = new MetadataConverter();
replServer.context.resolve = (path) => replServer.context.registryAccess.getComponentsFromPath(path)
