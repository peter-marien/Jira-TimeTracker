const assert = require('node:assert/strict');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');
const { pathToFileURL } = require('node:url');
const { BrowserWindow, ipcMain } = require('electron');

async function until(condition, label) {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
        if (await condition()) return;
        await delay(40);
    }
    throw new Error('Timed out waiting for ' + label);
}

async function evaluate(window, expression) {
    try { return await window.webContents.executeJavaScript(expression, true); }
    catch (error) { throw new Error('Could not evaluate renderer expression: ' + expression, { cause: error }); }
}

async function clickText(window, text) {
    const selector = 'button, a, [role=tab]';
    const command = `(() => {
        const scope = document.querySelector('mat-dialog-container') || document;
        const control = [...scope.querySelectorAll(${JSON.stringify(selector)})]
            .find(element => (element.textContent.trim() === ${JSON.stringify(text)} || element.getAttribute('aria-label') === ${JSON.stringify(text)}) && !element.disabled);
        if (!control) return false;
        control.click();
        return true;
    })()`;
    await until(() => evaluate(window, command), text);
}

async function input(window, selector, value) {
    const command = `(() => {
        const field = document.querySelector(${JSON.stringify(selector)});
        if (!field) return false;
        field.value = ${JSON.stringify(value)};
        field.dispatchEvent(new Event('input', { bubbles: true }));
        field.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
    })()`;
    await until(() => evaluate(window, command), selector);
}

async function hasText(window, text) {
    await until(() => evaluate(window, `document.body.textContent.includes(${JSON.stringify(text)})`), text);
}

async function dragTimelineSlice(window) {
    const { x, y } = await evaluate(window,
        '(() => { const rect = document.querySelector("app-day-timeline .slice button").getBoundingClientRect(); return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }; })()'
    );
    const debuggerSession = window.webContents.debugger;
    debuggerSession.attach();
    try {
        const dispatch = (type, targetX, buttons) => debuggerSession.sendCommand('Input.dispatchMouseEvent', {
            type, x: targetX, y, button: type === 'mouseMoved' ? 'none' : 'left', buttons, clickCount: 1
        });
        await dispatch('mousePressed', x, 1);
        await dispatch('mouseMoved', x + 40, 1);
        await dispatch('mouseReleased', x + 40, 0);
    } finally {
        debuggerSession.detach();
    }
}

async function runAngularSmoke() {
    const item = { id: 1, description: 'Smoke-test work item', jira_key: 'TEST-1', jira_connection_id: 1, is_completed: 0, total_seconds: 3600 };
    const connection = { id: 1, name: 'Smoke-test Jira', base_url: 'https://example.invalid', is_enabled: 1, is_default: 1 };
    const saved = { id: 1, work_item_id: 1, work_item_description: item.description, jira_key: item.jira_key,
        jira_connection_id: 1, connection_name: connection.name, start_time: localISOString(9),
        end_time: localISOString(10), notes: 'Original notes', tag_ids: [] };
    let snapshot = { revision: 0, activeSlice: null, workItem: null };
    let failStop = true;
    let awayDecision;
    let stopped;
    let jiraWorklog;
    const windows = [];
    const errors = [];
    const settings = { theme: 'light', update_check_interval: '0' };
    const tags = [{ id: 1, name: 'Existing tag', description: '' }];

    function broadcast(active) {
        snapshot = { revision: snapshot.revision + 1, activeSlice: active, workItem: active ? item : null };
        for (const window of windows) window.webContents.send('tracking:state', snapshot);
    }

    const handlers = {
        'app:get-version': () => '0.0.0-test',
        'window:is-maximized': () => false,
        'db:get-settings': () => settings,
        'db:save-setting': (_event, { key, value }) => {
            settings[key] = value;
            for (const window of windows) window.webContents.send('setting:updated', { key, value });
        },
        'db:get-all-connections': () => [connection],
        'db:get-recent-work-items': () => [item],
        'db:get-work-items': () => [item],
        'db:get-work-items-count': () => 1,
        'db:get-tags': () => tags,
        'db:save-tag': (_event, tag) => {
            const record = { id: tags.length + 1, ...tag };
            if (!record.id) record.id = tags.length + 1;
            tags.push(record);
            return record;
        },
        'db:get-time-slices': () => snapshot.activeSlice ? [saved, snapshot.activeSlice] : [saved],
        'db:get-time-slice': (_event, id) => id === stopped?.id ? stopped : saved,
        'db:search-time-slices': () => [saved],
        'db:search-time-slices-count': () => 1,
        'db:get-work-item-time-slices': () => [saved],
        'db:save-time-slice': (_event, patch) => {
            assert.equal(patch.id, saved.id);
            Object.assign(saved, patch);
            broadcast(snapshot.activeSlice);
            return saved;
        },
        'db:change-time-slices': (_event, { save }) => {
            for (const patch of save) {
                assert.equal(patch.id, saved.id);
                Object.assign(saved, patch);
            }
            broadcast(snapshot.activeSlice);
        },
        'jira:add-worklog': (_event, payload) => {
            jiraWorklog = payload;
            return { id: '9' };
        },
        'jira:search-issues-all-connections': (_event, query) => ({
            results: query === 'remote' ? [{ key: 'TEST-2', summary: 'Remote issue', connectionId: 1, connectionName: connection.name }] : [],
            errors: []
        }),
        'database:get-path': () => 'smoke-test.sqlite',
        'tracking:get-state': () => snapshot,
        'tracking:resolve-away': (_event, action) => { assert.equal(action, 'keep'); },
        'tracking:start': (_event, itemId) => {
            assert.equal(itemId, item.id);
            broadcast({ ...saved, id: 2, start_time: new Date().toISOString(), end_time: null });
        },
        'tracking:stop': () => {
            if (failStop) throw new Error('Simulated stop error');
            stopped = { ...snapshot.activeSlice, end_time: new Date().toISOString() };
            broadcast(null);
        }
    };
    for (const [channel, handler] of Object.entries(handlers)) ipcMain.handle(channel, handler);
    ipcMain.on('away-window:ready', event => event.sender.send('away:data', {
        awayStartTime: localISOString(9), awayDurationSeconds: 1200, currentWorkItem: item
    }));
    ipcMain.on('away:action', (_event, data) => { awayDecision = data; });
    ipcMain.on('log:renderer', (_event, payload) => {
        if (payload.level === 'error') errors.push(payload);
    });

    async function open(route, width = 1120, height = 800) {
        const window = new BrowserWindow({ show: false, width, height,
            webPreferences: { preload: path.resolve('dist-electron/preload.mjs'), contextIsolation: true }
        });
        windows.push(window);
        const url = pathToFileURL(path.resolve('dist/index.html'));
        if (route !== '/') url.hash = route;
        await window.loadURL(url.href);
        return window;
    }

    try {
        const main = await open('/');
        await hasText(main, 'Dashboard');
        await hasText(main, 'Original notes');
        for (const [selector, text] of [
            ['app-quick-start-panel button.hover\\:ring-2', 'TEST-1'],
            ['app-day-timeline .slice', 'Original notes']
        ]) {
            await until(() => evaluate(main, `!!document.querySelector(${JSON.stringify(selector)})`), selector);
            await evaluate(main, `document.querySelector(${JSON.stringify(selector)}).dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }))`);
            await until(() => evaluate(main, `document.querySelector('[role=tooltip]')?.textContent.includes(${JSON.stringify(text)})`), text + ' tooltip');
            await evaluate(main, `document.querySelector(${JSON.stringify(selector)}).dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }))`);
            await until(() => evaluate(main, `!document.querySelector('[role=tooltip]')`), 'tooltip dismissal');
        }
        const originalStart = saved.start_time;
        await dragTimelineSlice(main);
        await until(() => saved.start_time !== originalStart, 'saving a timeline drag');
        await hasText(main, 'Original notes');
        await clickText(main, 'Time slice actions');
        await until(() => evaluate(main, "document.querySelector('[role=menu]')?.textContent.includes('Copy to other days')"), 'time slice actions menu');
        await clickText(main, 'Edit Time');
        await hasText(main, 'Edit Time Slice');
        await evaluate(main, "document.querySelector('mat-dialog-container app-day-picker button[aria-haspopup=dialog]').click()");
        const clock = 'app-clock-input input';
        await until(() => evaluate(main, `!!document.querySelector('${clock}')`), 'start time picker');
        const initialTime = await evaluate(main, `document.querySelector('${clock}').value`);
        await evaluate(main, `{
            const field = document.querySelector('${clock}');
            field.focus();
            field.setSelectionRange(2, 2);
        }`);
        const keyboard = main.webContents.debugger;
        keyboard.attach();
        try {
            await keyboard.sendCommand('Input.dispatchKeyEvent', { type: 'char', text: '5' });
            assert.deepEqual(await evaluate(main, `{
                const field = document.querySelector('${clock}');
                [field.value, field.selectionStart];
            }`), [initialTime.slice(0, 3) + '5' + initialTime.slice(4), 4]);
            await keyboard.sendCommand('Input.dispatchKeyEvent', { type: 'char', text: '4' });
            assert.deepEqual(await evaluate(main, `{
                const field = document.querySelector('${clock}');
                [field.value, field.selectionStart];
            }`), [initialTime.slice(0, 3) + '54' + initialTime.slice(5), 5]);
        } finally {
            keyboard.detach();
        }
        await evaluate(main, "document.querySelector('.cdk-overlay-transparent-backdrop').click()");
        await input(main, 'textarea[formcontrolname=notes]', 'Updated by Angular');
        await evaluate(main, "document.querySelector('button[type=submit][form=time-slice-form]').click()");
        await hasText(main, 'Updated by Angular');
        assert.equal(saved.notes, 'Updated by Angular');
        assert.equal(new Date(saved.start_time).getMinutes(), 54);
        await clickText(main, 'Sync to Jira');
        await clickText(main, 'Sync Now');
        await hasText(main, '1 worklogs (1 slices) successfully synced to Jira.');
        assert.equal(jiraWorklog.connectionId, connection.id);
        assert.equal(jiraWorklog.comment, saved.notes);
        assert.equal(saved.jira_worklog_id, '9');
        await clickText(main, 'Close');
        await evaluate(main, 'document.querySelector("app-work-item-picker button").click()');
        await input(main, 'input[aria-label="Search work items (key or description)"]', 'remote');
        await hasText(main, 'Remote issue');
        await evaluate(main, 'document.querySelector(".cdk-overlay-transparent-backdrop").click()');

        const mini = await open('/mini-player', 360, 72);
        await until(() => evaluate(mini, '!!document.querySelector("app-mini-player input")'), 'the idle mini-player');
        await clickText(main, 'TEST-1');
        await until(() => evaluate(main, '!!document.querySelector("aside.tracking")'), 'the tracking banner');
        await hasText(mini, 'TEST-1');
        await evaluate(mini, 'document.querySelector("[aria-label=\\"Stop tracking\\"]").click()');
        await hasText(mini, 'Simulated stop error');
        assert.ok(snapshot.activeSlice);
        assert.equal(await evaluate(main, '!!document.querySelector("aside.tracking")'), true);
        failStop = false;
        await evaluate(mini, 'document.querySelector("[aria-label=\\"Stop tracking\\"]").click()');
        await until(() => evaluate(main, '!document.querySelector("aside.tracking")'), 'idle state in the main window');
        await until(() => evaluate(mini, '!!document.querySelector("app-mini-player input")'), 'idle state in the mini-player');
        await hasText(main, 'Edit Time Slice');
        await clickText(main, 'Close');

        const away = await open('/away', 550, 730);
        await hasText(away, '20m');
        await clickText(away, 'Confirm');
        await until(() => awayDecision, 'the away action');
        assert.equal(awayDecision.action, 'keep');

        await clickText(main, 'Work Items');
        await hasText(main, item.description);
        await clickText(main, 'Tags');
        await hasText(main, 'Existing tag');
        await input(main, 'input[formcontrolname=name]', 'New smoke tag');
        await clickText(main, 'Add Tag');
        await hasText(main, 'New smoke tag');

        await clickText(main, 'Month View');
        await hasText(main, item.description);
        await clickText(main, 'By Connection');
        await hasText(main, connection.name);
        await clickText(main, 'Daily Chart');
        await hasText(main, 'Total Hours');
        await clickText(main, 'Project Hours');
        await until(() => evaluate(main, '!!document.querySelector(".project-value")'), 'project hours bars');

        await clickText(main, 'Search');
        await input(main, 'input[aria-label="Search time slices"]', 'Updated');
        await hasText(main, 'Updated by Angular');
        await clickText(main, 'Reports');
        await until(() => evaluate(main, `!!document.querySelector('svg[aria-label="Yearly Overview"]')`), 'yearly overview plot');
        await clickText(main, 'Settings');
        await hasText(main, 'Appearance');
        await evaluate(main, `document.querySelector('mat-select[aria-label="Mini-player theme"] .mat-mdc-select-trigger').click()`);
        await until(() => evaluate(main, '!!document.querySelector(".legacy-select-panel [role=option]")'), 'mini-player theme options');
        await evaluate(main, 'document.querySelector(".cdk-overlay-transparent-backdrop").click()');
        await clickText(main, 'Connections');
        await hasText(main, connection.name);
        await clickText(main, 'Database');
        await hasText(main, 'smoke-test.sqlite');
        await clickText(main, 'Developer');
        await hasText(main, 'Developer Tools');
        assert.deepEqual(errors, []);
        console.log('PASS: all Angular screens, both desktop tools, persisted edits, Jira worklog payload, and cross-window tracking in Electron.');
    } finally {
        for (const window of windows) window.destroy();
    }
}

function localISOString(hour) {
    const date = new Date();
    date.setHours(hour, 0, 0, 0);
    return date.toISOString();
}

module.exports = { runAngularSmoke };
