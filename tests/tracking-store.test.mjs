import test from 'node:test';
import assert from 'node:assert/strict';
import * as timeUtils from '../src/lib/time-utils.ts';
import { loadElectronModule } from './load-electron-module.mjs';

const active = {
    revision: 1,
    activeSlice: { id: 1, work_item_id: 1, start_time: '2026-11-08T09:00:00Z', end_time: null },
    workItem: { id: 1, description: 'Investigation', total_seconds: 3600 }
};

function createStore(api) {
    return loadElectronModule('src/stores/useTrackingStore.ts', {
        '@/lib/api': { api },
        '@/lib/time-utils': timeUtils
    }).useTrackingStore;
}

test('late refresh cannot overwrite a newer stop snapshot in the main window', async () => {
    let resolve;
    const pending = new Promise(done => { resolve = done; });
    const store = createStore({ getTrackingSnapshot: () => pending });
    store.getState().applyTrackingSnapshot(active);
    const refreshing = store.getState().checkActiveTracking();
    store.getState().applyTrackingSnapshot({ revision: 2, activeSlice: null, workItem: null });
    resolve(active);
    await refreshing;
    assert.equal(store.getState().activeTimeSliceId, null);
    assert.equal(store.getState().totalTimeSpent, 0);
    assert.equal(store.getState().revision, 2);
});

test('stop failure leaves the main window tracking the saved active entry', async () => {
    const store = createStore({ stopTracking: async () => { throw new Error('save failed'); } });
    store.getState().applyTrackingSnapshot(active);
    await assert.rejects(store.getState().stopTracking(), /save failed/);
    assert.equal(store.getState().activeTimeSliceId, 1);
    assert.equal(store.getState().startTime, active.activeSlice.start_time);
});
