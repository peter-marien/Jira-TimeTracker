import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { verifyDatabaseCompatibility } from './database-fixture.mjs';

const require = createRequire(import.meta.url);
const application = path.join(path.dirname(process.execPath), 'resources', 'app.asar');
const pkg = require(path.join(application, 'package.json'));
assert.equal(pkg.name, 'jira-timetracker-app');
const Database = require(path.join(application, 'node_modules', 'better-sqlite3'));
verifyDatabaseCompatibility(path.join(process.argv[2], 'packaged-fixture.db'), Database);
console.log('PASS: packaged executable loads packaged SQLite and preserves the disposable fixture.');
