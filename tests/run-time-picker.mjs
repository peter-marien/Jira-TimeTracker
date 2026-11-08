import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import electron from 'electron';

await build({
    configFile: false,
    base: './',
    plugins: [react()],
    resolve: { alias: { '@': path.resolve('src') } },
    build: {
        outDir: 'out/ui-tests',
        emptyOutDir: true,
        rolldownOptions: { input: path.resolve('tests/time-picker.html') }
    }
});
const temporaryRoot = fs.realpathSync(os.tmpdir());
const profile = fs.mkdtempSync(path.join(temporaryRoot, 'jira-timetracker-input-test-'));
try {
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    process.stdout.write(execFileSync(electron, ['tests/time-picker-smoke.cjs', profile], {
        env, windowsHide: true, timeout: 30_000, encoding: 'utf8'
    }));
} finally {
    const resolved = fs.realpathSync(profile);
    if (path.dirname(resolved) !== temporaryRoot || !path.basename(resolved).startsWith('jira-timetracker-input-test-')) {
        throw new Error('Refusing to remove an unexpected input test directory.');
    }
    fs.rmSync(resolved, { recursive: true, force: true });
}
