import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

for (const timeZone of ['UTC', 'Europe/Brussels', 'America/New_York', 'Asia/Kolkata']) {
    test(`time normalization and rounding work in ${timeZone}`, () => {
        const result = spawnSync(process.execPath, ['--test', 'src/lib/time-utils.test.ts'], {
            env: { ...process.env, TZ: timeZone },
            encoding: 'utf8',
            windowsHide: true,
            timeout: 30_000
        });
        assert.ifError(result.error);
        assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    });
}
