import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { subscribeTrackingState, toTrackingData } from './tracking-state.ts';
import type { TrackingSnapshot } from './tracking-state.ts';

test('a delayed startup response cannot restart a stopped mini-player', async () => {
    const events = new EventEmitter();
    let resolveInitial!: (snapshot: TrackingSnapshot) => void;
    const initial = new Promise<TrackingSnapshot>(resolve => { resolveInitial = resolve; });
    const received: boolean[] = [];
    const unsubscribe = subscribeTrackingState({
        on: (channel, listener) => {
            events.on(channel, listener);
            return () => { events.removeListener(channel, listener); };
        },
        invoke: () => initial
    }, snapshot => received.push(toTrackingData(snapshot).isTracking), error => assert.fail(String(error)));

    events.emit('tracking:state', {}, { revision: 2, activeSlice: null, workItem: null });
    resolveInitial({
        revision: 1,
        activeSlice: { id: 1, work_item_id: 1, start_time: '2026-11-08T09:00:00Z' },
        workItem: { id: 1, description: 'Stopped task', is_completed: 0 }
    });
    await initial;
    await Promise.resolve();
    assert.deepEqual(received, [false]);
    unsubscribe();
    assert.equal(events.listenerCount('tracking:state'), 0);
});

test('unmount ignores a pending response and later updates', async () => {
    const events = new EventEmitter();
    let resolveInitial!: (snapshot: TrackingSnapshot) => void;
    const initial = new Promise<TrackingSnapshot>(resolve => { resolveInitial = resolve; });
    const received: TrackingSnapshot[] = [];
    const unsubscribe = subscribeTrackingState({
        on: (channel, listener) => {
            events.on(channel, listener);
            return () => { events.removeListener(channel, listener); };
        },
        invoke: () => initial
    }, snapshot => received.push(snapshot), error => assert.fail(String(error)));
    unsubscribe();
    resolveInitial({ revision: 1, activeSlice: null, workItem: null });
    events.emit('tracking:state', {}, { revision: 2, activeSlice: null, workItem: null });
    await initial;
    await Promise.resolve();
    assert.deepEqual(received, []);
});
