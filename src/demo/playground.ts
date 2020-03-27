import { SourceClient } from './library';
import { registryData } from '..';

const client = new SourceClient({});

async function deployClassSource() {
  const classPath = '/path/to/classes/Sample.cls';

  const result = await client.tooling.deployWithPaths({
    paths: [classPath],
    wait: 3
  });

  if (result.success) {
    const c = result.components[0];
    console.log(`Successfully deployed ${c.fullName}`);
  }
}

async function retrieve() {
  const type = registryData.types.apexclass;
  const components = [
    { fullName: 'Sample', type },
    { fullName: 'Sample2', type },
    { fullName: 'Sample3', type }
  ];

  const result = await client.metadata.retrieve({
    components,
    output: '/path/to/output',
    overwrite: true
  });

  if (result.success) {
    console.log(
      `Successfully retrieved ${result.components.length} components`
    );
  }
}

async function useAManifest() {
  const manifest = fs.readFileSync('/path/to/package.xml');

  const result = await client.metadata.retrieveWithManifest({
    xmlSource: manifest.toString(),
    output: '/path/to/output',
    convert: false
  });

  if (result.success) {
    console.log(
      `Successfully retrieved ${result.components.length} components`
    );
  }
}
