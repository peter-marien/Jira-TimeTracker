import { build } from 'esbuild';

const builds = [
    { entryPoints: ['electron/main.ts'], outfile: 'dist-electron/main.js' },
    { entryPoints: ['electron/preload.ts'], outfile: 'dist-electron/preload.mjs', format: 'cjs' }
];

await Promise.all(builds.map(options => build({
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    packages: 'external',
    logLevel: 'info',
    ...options
})));
