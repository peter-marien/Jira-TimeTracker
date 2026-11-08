import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { verifyDatabaseCompatibility } from './database-fixture.mjs';

const temporaryRoot = fs.realpathSync(os.tmpdir());
const directory = fs.mkdtempSync(path.join(temporaryRoot, 'jira-timetracker-sqlite-'));
try {
    verifyDatabaseCompatibility(path.join(directory, 'fixture.db'));
    console.log('PASS: native SQLite preserves saved fixture data, integrity, and rollback.');
} finally {
    const resolved = fs.realpathSync(directory);
    if (path.dirname(resolved) !== temporaryRoot || !path.basename(resolved).startsWith('jira-timetracker-sqlite-')) {
        throw new Error('Refusing to remove an unexpected fixture directory.');
    }
    fs.rmSync(resolved, { recursive: true, force: true });
}
