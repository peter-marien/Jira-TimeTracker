import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const executable = path.resolve(process.argv[2] || 'out/upgrade-package/win-unpacked/Jira Time Tracker.exe');
assert.ok(fs.existsSync(executable), `Package not found: ${executable}`);
const temporaryRoot = fs.realpathSync(os.tmpdir());
const profile = fs.mkdtempSync(path.join(temporaryRoot, 'jira-timetracker-package-test-'));
try {
    // Run the executable's native runtime without booting its application/default profile.
    const result = spawnSync(executable, ['tests/packaged-sqlite.mjs', profile], {
        env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
        windowsHide: true, timeout: 30_000, encoding: 'utf8'
    });
    assert.equal(result.status, 0, result.stderr || String(result.error));
    process.stdout.write(result.stdout);
} finally {
    const resolved = fs.realpathSync(profile);
    if (path.dirname(resolved) !== temporaryRoot || !path.basename(resolved).startsWith('jira-timetracker-package-test-')) {
        throw new Error('Refusing to remove an unexpected packaged test directory.');
    }
    fs.rmSync(resolved, { recursive: true, force: true });
}
