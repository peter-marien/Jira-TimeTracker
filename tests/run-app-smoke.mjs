import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import electron from 'electron';

const temporaryRoot = fs.realpathSync(os.tmpdir());
const profile = fs.mkdtempSync(path.join(temporaryRoot, 'jira-timetracker-app-test-'));
try {
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    const result = spawnSync(electron, ['tests/app-smoke.cjs', profile, ...process.argv.slice(2)], {
        env, windowsHide: true, timeout: 30_000, encoding: 'utf8'
    });
    const reportFile = path.join(profile, 'result.json');
    const report = fs.existsSync(reportFile) ? JSON.parse(fs.readFileSync(reportFile, 'utf8')) : {};
    assert.equal(result.status, 0, report.error || result.stderr || String(result.error));
    assert.equal(report.passed, true);
    assert.equal(report.databaseIsolated, true);
    console.log('PASS: built application opens using an isolated profile and disposable database.');
} finally {
    const resolved = fs.realpathSync(profile);
    if (path.dirname(resolved) !== temporaryRoot || !path.basename(resolved).startsWith('jira-timetracker-app-test-')) {
        throw new Error('Refusing to remove an unexpected application test directory.');
    }
    fs.rmSync(resolved, { recursive: true, force: true });
}
