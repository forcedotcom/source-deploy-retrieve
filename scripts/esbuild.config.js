/**
 * NOTE: This file does NOT really generate a bundle version of sdr
 * sdr is bundled directly in salesforcedx-vscode
 * The file is only used to detect any potential risks to esbuild.
 **/
const { build } = require('esbuild');

const sharedConfig = {
  bundle: true,
  format: 'cjs',
  platform: 'node',
  external: [], // The allowlist of dependencies that are not bundle-able
  keepNames: true,
  plugins: [],
  supported: {
    'dynamic-import': false,
  },
  logOverride: {
    'unsupported-dynamic-import': 'error',
  },
};

(async () => {
  await build({
    ...sharedConfig,
    entryPoints: ['./lib/src/index.js'],
    outdir: 'dist',
  });
})();
