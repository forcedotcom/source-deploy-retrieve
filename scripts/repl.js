#!/usr/bin/env node

const repl = require('repl');
const { Connection, AuthInfo } = require('@salesforce/core');
const { MetadataResolver, MetadataConverter, SourceClient, WorkingSet } = require('../lib/src');

const startMessage = `
Usage:
  resolve(path): resolve components from a path
  async convert(components, format, outputConfig): Convert metadata components to a target format
  async client(username): create a SourceClient
  time(func, mem = true): run function and report execution time and approx. heap usage
`
console.log(startMessage);

const replServer = repl.start({ breakEvalOnSigint: true });
replServer.setupHistory('.repl_history', (err, repl) => {});

const context = {
  MetadataResolver: MetadataResolver,
  MetadataConverter: MetadataConverter,
  WorkingSet: WorkingSet,
  resolve: (path) => {
    const resolver = new MetadataResolver();
    return resolver.getComponentsFromPath(path);
  },
  convert: async (components, targetFormat, outputConfig) => {
    converter = new MetadataConverter();
    return converter.convert(components, targetFormat, outputConfig);
  },
  client: async (username) => {
    return new SourceClient(await Connection.create({
      authInfo: await AuthInfo.create({ username })
    }))
  },
  time: async (func, mem = true) => {
    const logName = func.name || 'func';
    console.time(logName)
    const result = await func()
    console.timeEnd(logName)
    if (mem) {
      const { heapUsed } = process.memoryUsage();
      const MB = Math.round(heapUsed / 1024 / 1024)
      console.log(`Approx. heap usage: ${MB} MB`);
    }
    return result;
  }
}

Object.assign(replServer.context, context)
