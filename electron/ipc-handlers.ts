import { ipcMain, dialog } from 'electron'
import path from 'node:path'
import { getDatabase } from '../src/database/db'
import { updateTrayTooltip, updateTrayIcon } from './tray'
import { getAppConfig, saveAppConfig } from './config-service'

export function registerIpcHandlers() {
    const db = getDatabase()

    // Jira Connections
    ipcMain.handle('db:get-all-connections', () => {
        return db.prepare('SELECT * FROM jira_connections ORDER BY created_at DESC').all()
    })

    ipcMain.handle('db:save-connection', (_, connection) => {
        if (connection.id) {
            const stmt = db.prepare(`
        UPDATE jira_connections 
        SET name = @name, base_url = @base_url, email = @email, api_token = @api_token, is_default = @is_default, updated_at = unixepoch()
        WHERE id = @id
      `)
            return stmt.run(connection)
        } else {
            const stmt = db.prepare(`
        INSERT INTO jira_connections (name, base_url, email, api_token, is_default)
        VALUES (@name, @base_url, @email, @api_token, @is_default)
      `)
            return stmt.run(connection)
        }
    })

    ipcMain.handle('db:delete-connection', (_, id) => {
        return db.prepare('DELETE FROM jira_connections WHERE id = ?').run(id)
    })

    // Work Items
    ipcMain.handle('db:get-work-items', (_, { query = '', limit = 50, offset = 0, showCompleted = false } = {}) => {
        const sql = `
        SELECT wi.*, jc.name as connection_name,
               COALESCE(SUM(strftime('%s', COALESCE(ts.end_time, 'now')) - strftime('%s', ts.start_time)), 0) as total_seconds
        FROM work_items wi
        LEFT JOIN jira_connections jc ON wi.jira_connection_id = jc.id
        LEFT JOIN time_slices ts ON wi.id = ts.work_item_id
        WHERE (wi.description LIKE @query OR wi.jira_key LIKE @query)
        AND (@showCompleted = 1 OR wi.is_completed = 0)
        GROUP BY wi.id
        ORDER BY wi.jira_key ASC, wi.description ASC
        LIMIT @limit OFFSET @offset
      `
        return db.prepare(sql).all({ query: `%${query}%`, limit, offset, showCompleted: showCompleted ? 1 : 0 })
    })

    ipcMain.handle('db:get-work-items-count', (_, { query = '', showCompleted = false } = {}) => {
        const sql = `
        SELECT COUNT(*) as count
        FROM work_items
        WHERE (description LIKE @query OR jira_key LIKE @query)
        AND (@showCompleted = 1 OR is_completed = 0)
      `
        const result = db.prepare(sql).get({ query: `%${query}%`, showCompleted: showCompleted ? 1 : 0 }) as { count: number };
        return result.count;
    })

    ipcMain.handle('db:get-work-item', (_, id: number) => {
        const sql = `
            SELECT wi.*, jc.name as connection_name,
                   COALESCE(SUM(strftime('%s', COALESCE(ts.end_time, 'now')) - strftime('%s', ts.start_time)), 0) as total_seconds
            FROM work_items wi
            LEFT JOIN jira_connections jc ON wi.jira_connection_id = jc.id
            LEFT JOIN time_slices ts ON wi.id = ts.work_item_id
            WHERE wi.id = ?
            GROUP BY wi.id
        `
        return db.prepare(sql).get(id);
    })

    ipcMain.handle('db:save-work-item', (_, item) => {
        if (item.id) {
            const stmt = db.prepare(`
        UPDATE work_items 
        SET jira_connection_id = @jira_connection_id, jira_key = @jira_key, description = @description, updated_at = unixepoch()
        WHERE id = @id
      `)
            return stmt.run(item)
        } else {
            const stmt = db.prepare(`
        INSERT INTO work_items (jira_connection_id, jira_key, description)
        VALUES (@jira_connection_id, @jira_key, @description)
      `)
            const info = stmt.run(item)
            return { id: info.lastInsertRowid, ...item }
        }
    })

    ipcMain.handle('db:delete-work-item', (_, id) => {
        const count = db.prepare('SELECT COUNT(*) as count FROM time_slices WHERE work_item_id = ?').get(id) as { count: number };
        if (count.count > 0) {
            throw new Error('Cannot delete work item with existing time slices.');
        }
        return db.prepare('DELETE FROM work_items WHERE id = ?').run(id);
    })

    ipcMain.handle('db:update-work-item-completion', (_, { ids, completed }) => {
        const placeholders = ids.map(() => '?').join(',');
        const stmt = db.prepare(`UPDATE work_items SET is_completed = ?, updated_at = unixepoch() WHERE id IN (${placeholders})`);
        return stmt.run(completed ? 1 : 0, ...ids);
    })

    ipcMain.handle('db:get-recent-work-items', (_) => {
        const sql = `
            SELECT wi.*, jc.name as connection_name
            FROM work_items wi
            LEFT JOIN jira_connections jc ON wi.jira_connection_id = jc.id
            JOIN (
                SELECT work_item_id, MAX(start_time) as last_start
                FROM time_slices
                GROUP BY work_item_id
            ) recent ON wi.id = recent.work_item_id
            WHERE wi.is_completed = 0
            ORDER BY recent.last_start DESC
            LIMIT 5
        `;
        return db.prepare(sql).all();
    });

    // Time Slices
    ipcMain.handle('db:get-time-slices', (_, { startStr, endStr }) => {
        const stmt = db.prepare(`
            SELECT ts.*, wi.description as work_item_description, wi.jira_key, jc.name as connection_name
            FROM time_slices ts 
            LEFT JOIN work_items wi ON ts.work_item_id = wi.id 
            LEFT JOIN jira_connections jc ON wi.jira_connection_id = jc.id
            WHERE ts.start_time >= @startStr AND ts.start_time <= @endStr
            ORDER BY ts.start_time
        `);
        return stmt.all({ startStr, endStr });
    });

    ipcMain.handle('db:get-time-slice', (_, id: number) => {
        const stmt = db.prepare(`
            SELECT ts.*, wi.description as work_item_description, wi.jira_key, jc.name as connection_name
            FROM time_slices ts 
            LEFT JOIN work_items wi ON ts.work_item_id = wi.id 
            LEFT JOIN jira_connections jc ON wi.jira_connection_id = jc.id
            WHERE ts.id = ?
        `);
        return stmt.get(id);
    });

    ipcMain.handle('db:save-time-slice', (_, slice) => {
        if (slice.id) {
            const stmt = db.prepare(`
            UPDATE time_slices
            SET work_item_id = @work_item_id, start_time = @start_time, end_time = @end_time, notes = @notes, synced_to_jira = @synced_to_jira, jira_worklog_id = @jira_worklog_id, synced_start_time = @synced_start_time, synced_end_time = @synced_end_time, updated_at = unixepoch()
            WHERE id = @id
        `)
            const params = {
                id: slice.id,
                work_item_id: slice.work_item_id,
                start_time: slice.start_time,
                end_time: slice.end_time || null,
                notes: slice.notes || '',
                synced_to_jira: slice.synced_to_jira || 0,
                jira_worklog_id: slice.jira_worklog_id || null,
                synced_start_time: slice.synced_start_time || null,
                synced_end_time: slice.synced_end_time || null
            };
            return stmt.run(params)
        } else {
            const stmt = db.prepare(`
                INSERT INTO time_slices (work_item_id, start_time, end_time, notes, synced_to_jira, jira_worklog_id, synced_start_time, synced_end_time)
                VALUES (@work_item_id, @start_time, @end_time, @notes, @synced_to_jira, @jira_worklog_id, @synced_start_time, @synced_end_time)
            `)
            const params = {
                work_item_id: slice.work_item_id,
                start_time: slice.start_time,
                end_time: slice.end_time || null,
                notes: slice.notes || '',
                synced_to_jira: slice.synced_to_jira || 0,
                jira_worklog_id: slice.jira_worklog_id || null,
                synced_start_time: slice.synced_start_time || null,
                synced_end_time: slice.synced_end_time || null
            };
            const info = stmt.run(params)
            return { id: info.lastInsertRowid, ...slice }
        }
    })

    ipcMain.handle('db:get-active-time-slice', () => {
        return db.prepare('SELECT * FROM time_slices WHERE end_time IS NULL LIMIT 1').get()
    })

    ipcMain.handle('db:delete-time-slice', (_, id) => {
        return db.prepare('DELETE FROM time_slices WHERE id = ?').run(id)
    })

    ipcMain.handle('db:get-work-item-time-slices', (_, workItemId: number) => {
        const stmt = db.prepare(`
            SELECT ts.*, wi.description as work_item_description, wi.jira_key, jc.name as connection_name
            FROM time_slices ts 
            LEFT JOIN work_items wi ON ts.work_item_id = wi.id 
            LEFT JOIN jira_connections jc ON wi.jira_connection_id = jc.id
            WHERE ts.work_item_id = ?
            ORDER BY ts.start_time ASC
        `);
        return stmt.all(workItemId);
    });

    ipcMain.handle('db:clear-data', (_, { clearTimeSlices, clearWorkItems }: { clearTimeSlices: boolean, clearWorkItems: boolean }) => {
        if (clearWorkItems) {
            return db.prepare('DELETE FROM work_items').run();
        } else if (clearTimeSlices) {
            return db.prepare('DELETE FROM time_slices').run();
        }
    });

    // Settings
    ipcMain.handle('db:get-settings', () => {
        const stmt = db.prepare('SELECT key, value FROM settings');
        const rows = stmt.all() as { key: string, value: string }[];
        return rows.reduce((acc, row) => ({ ...acc, [row.key]: row.value }), {});
    });

    ipcMain.handle('db:save-setting', (_, { key, value }: { key: string, value: string }) => {
        const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)');
        stmt.run(key, value, Date.now());
        return { success: true };
    });

    // Jira API
    ipcMain.handle('jira:search-issues', async (_, query: string) => {
        const stmt = db.prepare('SELECT * FROM jira_connections WHERE is_default = 1 LIMIT 1');
        const conn = stmt.get() as any;

        if (!conn) {
            throw new Error("No default Jira connection found");
        }

        const { JiraClient } = await import('../src/services/jira/jira-client');
        const client = new JiraClient({
            baseUrl: conn.base_url,
            email: conn.email,
            apiToken: conn.api_token
        });

        let jql = query.trim();
        if (jql && !jql.includes('=') && !jql.includes('~')) {
            const sanitized = jql.replace(/["\\]/g, '');
            if (/^[A-Za-z]+-[0-9]+$/.test(sanitized)) {
                jql = `key = "${sanitized}" OR summary ~ "${sanitized}*"`;
            } else {
                jql = `summary ~ "${sanitized}*"`;
            }
        }

        return await client.searchIssues(jql);
    });

    ipcMain.handle('jira:add-worklog', async (_, { issueKey, timeSpentSeconds, comment, started }) => {
        const stmt = db.prepare('SELECT * FROM jira_connections WHERE is_default = 1 LIMIT 1');
        const conn = stmt.get() as any;
        if (!conn) throw new Error("No connection");

        const { JiraClient } = await import('../src/services/jira/jira-client');
        const client = new JiraClient({
            baseUrl: conn.base_url,
            email: conn.email,
            apiToken: conn.api_token
        });

        return await client.addWorklog(issueKey, {
            timeSpentSeconds,
            comment,
            started
        });
    });

    ipcMain.handle('jira:get-worklogs', async (_, { issueKey }) => {
        const stmt = db.prepare('SELECT * FROM jira_connections WHERE is_default = 1 LIMIT 1');
        const conn = stmt.get() as any;
        if (!conn) throw new Error("No connection");

        const { JiraClient } = await import('../src/services/jira/jira-client');
        const client = new JiraClient({
            baseUrl: conn.base_url,
            email: conn.email,
            apiToken: conn.api_token
        });

        return await client.getWorklogs(issueKey);
    });

    ipcMain.handle('jira:update-worklog', async (_, { issueKey, worklogId, timeSpentSeconds, comment, started }) => {
        const stmt = db.prepare('SELECT * FROM jira_connections WHERE is_default = 1 LIMIT 1');
        const conn = stmt.get() as any;
        if (!conn) throw new Error("No default Jira connection configured");

        const { JiraClient } = await import('../src/services/jira/jira-client');
        const client = new JiraClient({
            baseUrl: conn.base_url,
            email: conn.email,
            apiToken: conn.api_token
        });

        try {
            return await client.updateWorklog(issueKey, worklogId, {
                timeSpentSeconds,
                comment,
                started
            });
        } catch (error: any) {
            throw error;
        }
    });

    ipcMain.handle('jira:test-connection', async (_, config) => {
        const { JiraClient } = await import('../src/services/jira/jira-client');
        const client = new JiraClient({
            baseUrl: config.baseUrl,
            email: config.email,
            apiToken: config.apiToken
        });

        try {
            const user = await client.getCurrentUser();
            return { success: true, displayName: user.displayName };
        } catch (e: any) {
            const msg = e.response?.status === 401 ? 'Authentication failed. Check credentials.' :
                e.code === 'ENOTFOUND' ? 'Host not found. Check URL.' :
                    e.message;
            return { success: false, error: msg };
        }
    });

    // Tray
    ipcMain.handle('tray:set-tooltip', (_, text: string) => {
        updateTrayTooltip(text);
    });

    ipcMain.handle('tray:set-icon', (_, type: 'active' | 'idle', description?: string) => {
        updateTrayIcon(type, description);
    });

    // Database Path
    ipcMain.handle('database:get-path', () => {
        return getAppConfig().databasePath;
    });

    ipcMain.handle('database:save-path', async (_, newFolderPath: string) => {
        const fullPath = path.join(newFolderPath, 'jira-timetracker.db');
        saveAppConfig({ databasePath: fullPath });
        return fullPath;
    });

    ipcMain.handle('database:select-path', async () => {
        const result = await dialog.showOpenDialog({
            properties: ['openDirectory'],
            title: 'Select Database Folder'
        });

        if (result.canceled || result.filePaths.length === 0) {
            return null;
        }

        return result.filePaths[0];
    });

    // CSV Import
    ipcMain.handle('database:select-csv', async () => {
        const result = await dialog.showOpenDialog({
            properties: ['openFile'],
            title: 'Select CSV File to Import',
            filters: [{ name: 'CSV Files', extensions: ['csv'] }]
        });

        if (result.canceled || result.filePaths.length === 0) {
            return null;
        }

        return result.filePaths[0];
    });

    ipcMain.handle('database:import-csv', async (_, csvContent: string) => {
        const rows = parseCSV(csvContent);
        if (rows.length < 2) {
            throw new Error('CSV file must have a header row and at least one data row');
        }

        const dataRows = rows.slice(1);
        let importedSlices = 0;
        let createdWorkItems = 0;
        let reusedWorkItems = 0;
        let skippedLines = 0;

        const defaultConn = db.prepare('SELECT id FROM jira_connections WHERE is_default = 1 LIMIT 1').get() as { id: number } | undefined;

        for (let rowIndex = 0; rowIndex < dataRows.length; rowIndex++) {
            const fields = dataRows[rowIndex];
            if (fields.length < 4) {
                skippedLines++;
                continue;
            }

            const [startTimeStr, endTimeStr, notes, description, jiraKey] = fields;
            if (!startTimeStr?.trim() || !description?.trim()) {
                skippedLines++;
                continue;
            }

            const startTime = startTimeStr.trim().replace(' ', 'T') + 'Z';
            const endTime = endTimeStr?.trim() ? endTimeStr.trim().replace(' ', 'T') + 'Z' : null;

            let workItem: { id: number } | undefined;
            if (jiraKey && jiraKey.trim()) {
                workItem = db.prepare(
                    'SELECT id FROM work_items WHERE jira_key = ? AND description = ?'
                ).get(jiraKey.trim(), description.trim()) as { id: number } | undefined;
            }

            if (!workItem) {
                workItem = db.prepare(
                    'SELECT id FROM work_items WHERE description = ? AND (jira_key IS NULL OR jira_key = ?)'
                ).get(description.trim(), jiraKey?.trim() || null) as { id: number } | undefined;
            }

            if (workItem) {
                reusedWorkItems++;
            } else {
                const stmt = db.prepare(`
                    INSERT INTO work_items (jira_connection_id, jira_key, description)
                    VALUES (@jira_connection_id, @jira_key, @description)
                `);
                const info = stmt.run({
                    jira_connection_id: jiraKey?.trim() ? (defaultConn?.id || null) : null,
                    jira_key: jiraKey?.trim() || null,
                    description: description.trim()
                });
                workItem = { id: info.lastInsertRowid as number };
                createdWorkItems++;
            }

            const sliceStmt = db.prepare(`
                INSERT INTO time_slices (work_item_id, start_time, end_time, notes)
                VALUES (@work_item_id, @start_time, @end_time, @notes)
            `);

            const normalizedNotes = (notes || '')
                .replace(/\r\n/g, '\n')
                .replace(/\r/g, '\n')
                .replace(/\\n/g, '\n')
                .replace(/\\r/g, '\n')
                .trim();

            sliceStmt.run({
                work_item_id: workItem.id,
                start_time: startTime,
                end_time: endTime,
                notes: normalizedNotes
            });
            importedSlices++;
        }

        return {
            importedSlices,
            createdWorkItems,
            reusedWorkItems,
            skippedLines
        };
    });

    // File System
    ipcMain.handle('fs:read-file', async (_, filePath: string) => {
        const fs = await import('node:fs/promises');
        return await fs.readFile(filePath, 'utf-8');
    });
}

function parseCSV(content: string): string[][] {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentField = '';
    let inQuotes = false;

    for (let i = 0; i < content.length; i++) {
        const char = content[i];
        const nextChar = content[i + 1];

        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                currentField += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            currentRow.push(currentField);
            currentField = '';
        } else if ((char === '\n' || (char === '\r' && nextChar === '\n')) && !inQuotes) {
            if (char === '\r') i++;
            currentRow.push(currentField);
            if (currentRow.some(f => f.trim().length > 0)) {
                rows.push(currentRow);
            }
            currentRow = [];
            currentField = '';
        } else if (char === '\r' && !inQuotes) {
            currentRow.push(currentField);
            if (currentRow.some(f => f.trim().length > 0)) {
                rows.push(currentRow);
            }
            currentRow = [];
            currentField = '';
        } else {
            currentField += char;
        }
    }

    currentRow.push(currentField);
    if (currentRow.some(f => f.trim().length > 0)) {
        rows.push(currentRow);
    }

    return rows;
}
