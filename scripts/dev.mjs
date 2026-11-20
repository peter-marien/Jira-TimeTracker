import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { once } from 'node:events';
import { setTimeout } from 'node:timers/promises';

const require = createRequire(import.meta.url);
const url = 'http://127.0.0.1:4200/';
const children = new Set();

function start(executable, args, options = {}) {
    const child = spawn(executable, args, { stdio: 'inherit', ...options });
    children.add(child);
    child.once('exit', () => children.delete(child));
    return child;
}

process.on('exit', () => {
    for (const child of children) child.kill();
});
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => process.exit(0));

const [buildCode] = await once(start(process.execPath, ['scripts/build-electron.mjs']), 'exit');
if (buildCode !== 0) process.exit(buildCode ?? 1);

const server = start(process.execPath, [require.resolve('@angular/cli/bin/ng.js'), 'serve', '--host', '127.0.0.1']);
let ready = false;
for (let attempt = 0; attempt < 120 && server.exitCode === null; attempt++) {
    if (await fetch(url).then(response => response.ok).catch(() => false)) {
        ready = true;
        break;
    }
    await setTimeout(500);
}
if (!ready) throw new Error('The Angular development server did not start.');

const desktop = start(require('electron'), ['.'], {
    env: { ...process.env, JIRA_TRACKER_RENDERER_URL: url }
});
const [code] = await once(desktop, 'exit');
process.exit(code ?? 0);
