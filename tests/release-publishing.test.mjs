import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { publishRelease } from '../scripts/publish-release.mjs';

const version = '0.18.0';
const installer = `Jira-Time-Tracker-Windows-${version}-Setup.exe`;
const requiredFiles = [installer, `${installer}.blockmap`, 'latest.yml'];

function fixture(t, { missing, empty } = {}) {
    const root = mkdtempSync(path.join(tmpdir(), 'jira-release-test-'));
    t.after(() => {
        assert.equal(path.dirname(root), path.resolve(tmpdir()));
        rmSync(root, { recursive: true, force: true });
    });
    writeFileSync(path.join(root, 'package.json'), JSON.stringify({
        version,
        build: {
            productName: 'Jira Time Tracker',
            directories: { output: 'release/${version}' },
            win: { artifactName: '${productName}-Windows-${version}-Setup.${ext}' },
        },
    }));
    const output = path.join(root, 'release', version);
    mkdirSync(output, { recursive: true });
    for (const name of requiredFiles) {
        if (name === missing) continue;
        const localName = name.replace('Jira-Time-Tracker', 'Jira Time Tracker');
        writeFileSync(path.join(output, localName), name === empty ? '' : 'artifact');
    }
    return root;
}

for (const name of requiredFiles) {
    for (const failure of ['missing', 'empty']) {
        test(`rejects ${failure} local ${name} before contacting GitHub`, t => {
            const root = fixture(t, { [failure]: name });
            assert.throws(() => publishRelease(root, () => assert.fail('Must not contact GitHub')), /Required release file/);
        });
    }
    test(`rejects a GitHub release missing ${name}`, t => {
        const root = fixture(t);
        assert.throws(() => publishRelease(root, args => {
            if (args[0] === 'api') return '[]';
            if (args[1] === 'view') return JSON.stringify({ assets: requiredFiles.filter(file => file !== name).map(name => ({ name, size: 8 })) });
            return '';
        }), /Missing or incomplete uploaded release file/);
    });
}

test('uploads all files to one draft and verifies their sizes', t => {
    const root = fixture(t);
    const calls = [];
    publishRelease(root, args => {
        calls.push(args);
        if (args[0] === 'api') return '[]';
        if (args[1] === 'view') return JSON.stringify({ assets: requiredFiles.map(name => ({ name, size: 8 })) });
        return '';
    });
    assert.deepEqual(calls.slice(1).map(args => args[1]), ['create', 'upload', 'view']);
    assert.ok(calls[1].includes('--draft'));
    assert.ok(calls[1].includes('--verify-tag'));
    assert.deepEqual(calls[2].slice(3).map(file => path.basename(file)), requiredFiles);
});

test('rejects truncated uploads', t => {
    const root = fixture(t);
    assert.throws(() => publishRelease(root, args => args[0] === 'api' ? '[]' : args[1] === 'view'
        ? JSON.stringify({ assets: requiredFiles.map(name => ({ name, size: 1 })) })
        : ''), /Missing or incomplete uploaded release file/);
});

test('stops immediately if release creation or upload fails', t => {
    for (const failedCommand of ['create', 'upload']) {
        const root = fixture(t);
        const calls = [];
        assert.throws(() => publishRelease(root, args => {
            calls.push(args[1]);
            if (args[0] === 'api') return '[]';
            if (args[1] === failedCommand) throw new Error('GitHub failure');
            return '';
        }), /GitHub failure/);
        assert.equal(calls.at(-1), failedCommand);
    }
});

test('refuses existing public or draft releases, including later result pages', t => {
    for (const draft of [true, false]) {
        const root = fixture(t);
        assert.throws(() => publishRelease(root, args => {
            assert.equal(args[0], 'api');
            assert.ok(args.includes('--paginate'));
            return JSON.stringify([[], [{ tag_name: `v${version}`, draft }]]);
        }), /already exists/);
    }
});
