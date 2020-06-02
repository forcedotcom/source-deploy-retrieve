const { RegistryAccess, MetadataConverter } = require('../lib');
const { PerformanceObserver, performance } = require('perf_hooks');

const obs = new PerformanceObserver(items => {
  const e = items.getEntries()[0];
  console.log(`${e.name} - ${e.duration}`);
});
obs.observe({ entryTypes: ['measure'] });

performance.mark('component_resolution');
const registry = new RegistryAccess();
const components = registry.getComponentsFromPath(
  '/Users/b.powell/dev/dx-projects/sample-convert/force-app'
);
performance.mark('convert');
performance.measure('Component Resolution to Convert', 'component_resolution', 'convert');

const converter = new MetadataConverter();
async function go() {
  await converter.convert(components, 'metadata', {
    type: 'directory',
    options: { packageName: 'why', outputDirectory: '/Users/b.powell/Desktop' }
  });
  performance.mark('finish');
  performance.measure('Conversion', 'convert', 'finish');
}

go();
