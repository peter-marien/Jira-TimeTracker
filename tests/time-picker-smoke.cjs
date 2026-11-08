const assert = require('node:assert/strict');
const path = require('node:path');
const { app, BrowserWindow } = require('electron');

app.setPath('userData', process.argv[2]);
app.disableHardwareAcceleration();
const delay = () => new Promise(resolve => setTimeout(resolve, 50));
app.whenReady().then(async () => {
    const window = new BrowserWindow({ show: false, webPreferences: { backgroundThrottling: false } });
    const evaluate = code => window.webContents.executeJavaScript(code);
    const render = async (props, reset = true) => {
        await evaluate(`window.timePickerTest.render(${JSON.stringify(props)}, ${reset})`);
        await delay();
    };
    const value = () => evaluate(`document.querySelector('input').value`);
    const values = () => evaluate(`window.timePickerTest.values`);
    const focus = async () => {
        window.webContents.focus();
        await evaluate(`document.querySelector('input').focus()`);
        await delay();
    };
    const blur = async () => {
        await evaluate(`document.querySelector('input').blur()`);
        await delay();
    };
    const type = async digits => {
        await delay();
        for (const digit of digits) {
            window.webContents.sendInputEvent({ type: 'keyDown', keyCode: digit });
            window.webContents.sendInputEvent({ type: 'char', keyCode: digit });
            window.webContents.sendInputEvent({ type: 'keyUp', keyCode: digit });
            await delay();
        }
    };
    await window.loadFile(path.resolve('out/ui-tests/tests/time-picker.html'));
    window.webContents.focus();
    await delay();

    await render({ value: '12:34' });
    assert.equal(await value(), '12:34:00');
    await render({ value: '08:09:10' }, false);
    assert.equal(await value(), '08:09:10');
    assert.deepEqual(await values(), [], 'prop changes must not emit user edits');

    await focus();
    await evaluate(`document.querySelector('input').setSelectionRange(0, 8)`);
    await type('123456');
    assert.equal(await value(), '12:34:56');
    assert.equal((await values()).at(-1), '12:34:56');
    await evaluate(`document.querySelector('input').setSelectionRange(3, 5)`);
    await type('20');
    assert.equal(await value(), '12:20:56', 'editing minutes preserves hours and seconds');
    await evaluate(`document.querySelector('input').setSelectionRange(3, 5)`);
    await delay();
    window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Backspace' });
    window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Backspace' });
    await delay();
    assert.equal(await value(), '12:__:56', 'deleting minutes preserves seconds');
    await type('40');
    assert.equal(await value(), '12:40:56');
    await evaluate(`document.querySelector('input').setSelectionRange(0, 8)`);
    await delay();
    await window.webContents.insertText('09:15:30');
    await delay();
    assert.equal(await value(), '09:15:30', 'text insertion accepts a formatted time');

    await render({ value: '' });
    await focus();
    await type('1');
    await blur();
    assert.equal(await value(), '10:00:00');
    assert.equal((await values()).at(-1), '10:00:00');

    await render({ value: '' });
    await focus();
    await type('256161');
    await blur();
    assert.equal((await values()).length, 0, 'invalid times must not be saved');
    assert.ok(await evaluate(`document.body.textContent.includes('Invalid time')`));

    await render({ value: '', allowEmpty: true });
    assert.equal(await value(), '');
    assert.equal(await evaluate(`document.querySelector('input').placeholder`), 'Active');
    await focus();
    await blur();
    assert.equal(await value(), '');
    await render({ value: '12:34:56', allowEmpty: true });
    await evaluate(`document.querySelector('button').click()`);
    await delay();
    assert.equal(await value(), '');
    assert.equal((await values()).at(-1), '');

    await render({ value: '12:34:56', disabled: true, allowEmpty: true });
    assert.equal(await evaluate(`document.querySelector('input').disabled`), true);
    assert.equal(await evaluate(`document.querySelector('button')`), null);
    console.log('PASS: time input typing, caret edits, normalization, validation, clear, props, and disabled state.');
    app.exit(0);
}).catch(error => {
    console.error(error);
    app.exit(1);
});
