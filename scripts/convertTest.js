const { convertSource, RegistryAccess } = require('../lib');
const { existsSync, rmdirSync } = require('fs');

async function time(f) {
  const start = new Date();
  await f();
  //@ts-ignore
  const elapsed = new Date() - start;
  return elapsed;
}

const pathToLargeForceApp = '/Users/b.powell/dev/dx-projects/sample-convert/force-app';
const pathToSmallForceApp = '/Users/b.powell/dev/dx-projects/sample-convert-small/force-app';
const pathToMediumForceApp = '/Users/b.powell/dev/dx-projects/sample-convert-medium/force-app';
const destination = '/Users/b.powell/Desktop/converted';

async function test(forceApp) {
  let components;
  const resolveTime = await time(() => {
    const registry = new RegistryAccess();
    components = registry.getComponentsFromPath(forceApp);
  });
  const convertTime = await time(async () => {
    return convertSource(components, { output: destination });
  });
  console.log(`Resolving Components: ${resolveTime} ms`);
  console.log(`Conversion: ${convertTime} ms`);
  console.log(`Total: ${resolveTime + convertTime} ms`);
  console.log(`Memory Consumption: ${process.memoryUsage().heapUsed / 1024 / 1024} MB`);
}

// async function testCli(forceApp) {
//   const elapsed = await time(async () => {
//     await convertSourceCli(forceApp, destination);
//   });
//   console.log(`Total: ${elapsed} ms`);
//   console.log(`Memory Consumption: ${process.memoryUsage().heapUsed / 1024 / 1024} MB`);
// }

// testCli(pathToSmallForceApp);
// test(pathToSmallForceApp);

// testCli(pathToMediumForceApp);
// test(pathToMediumForceApp);

// testCli(pathToLargeForceApp);
test(pathToLargeForceApp);
