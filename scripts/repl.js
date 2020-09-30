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

const context = {
  RegistryAccess: RegistryAccess,
  MetadataConverter: MetadataConverter,
  resolve: (path) => {
    const registryAccess = new RegistryAccess();
    return registryAccess.getComponentsFromPath(path);
  },
  convert: async (components, format, outputConfig) => {
    converter = new MetadataConverter();
    return converter.convert(components, format, outputConfig);
  },
  client: async (username) => {
    return new SourceClient(await Connection.create({
      authInfo: await AuthInfo.create({ username })
    }))
  },
  time: async (func, mem = true) => {
    const logName = func.name || 'func';
    console.log('\n')
    console.time(logName)
    const result = await func()
    console.timeEnd(logName)
    if (mem) {
      const { heapUsed } = process.memoryUsage();
      const MB = Math.round(heapUsed / 1024 / 1024)
      console.log(`Approx. heap usage: ${MB} MB`);
    }
    return result;
  },
  doit: async (path) => {
    context.time(async () => {
      const c = context.resolve(path);
      await context.convert(c, 'metadata', { type: 'directory', outputDirectory: '/Users/b.powell/Desktop' })
    })
  }
}

Object.assign(replServer.context, context)
