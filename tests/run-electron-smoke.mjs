import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import electron from 'electron';

const temporaryRoot = fs.realpathSync(os.tmpdir());
const userData = fs.mkdtempSync(path.join(temporaryRoot, 'jira-timetracker-test-'));
try {
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    const output = execFileSync(electron, ['tests/electron-smoke.cjs', userData], {
        env, windowsHide: true, timeout: 30_000, encoding: 'utf8'
    });
    process.stdout.write(output);
} finally {
    const resolved = fs.realpathSync(userData);
    if (path.dirname(resolved) !== temporaryRoot || !path.basename(resolved).startsWith('jira-timetracker-test-')) {
        throw new Error('Refusing to remove an unexpected test directory.');
    }
    fs.rmSync(resolved, { recursive: true, force: true });
}
