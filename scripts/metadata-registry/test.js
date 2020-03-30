const { RegistryAccess } = require('../../lib');

const r = new RegistryAccess();

const trials = 20;
let total = 0;

let components;

for (let i = 0; i < trials; i++) {
  const start = new Date();
  components = r.getComponentsFromPath(
    '/Users/b.powell/dev/dx-projects/dreamhouse-lwc/force-app'
  );
  const end = new Date() - start;
  total += end;
  // console.log('count: ' + components.length);
}

console.log(`Avg time for ${trials} trials: %dms`, total / trials);
