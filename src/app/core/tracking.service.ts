import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import type { WorkItem } from '@/lib/api';
import { subscribeTrackingState, type TrackingSnapshot } from '@/lib/tracking-state';
import { DESKTOP_API, DESKTOP_IPC, Feedback } from './desktop.service';

export type AwayAction = 'discard' | 'keep' | 'reassign';

@Injectable({ providedIn: 'root' })
export class TrackingService {
    private readonly api = inject(DESKTOP_API);
    private readonly ipc = inject(DESKTOP_IPC);
    private readonly destroyRef = inject(DestroyRef);
    private readonly feedback = inject(Feedback);
    private readonly clock = signal(Date.now());
    private readonly snapshot = signal<TrackingSnapshot>({ revision: -1, activeSlice: null, workItem: null });
    private readonly historicalSeconds = signal(0);
    readonly revision = computed(() => this.snapshot().revision);
    readonly activeSlice = computed(() => this.snapshot().activeSlice);
    readonly workItem = computed(() => this.snapshot().workItem);
    readonly elapsedSeconds = computed(() => {
        const active = this.activeSlice();
        return active ? Math.max(0, Math.floor((this.clock() - Date.parse(active.start_time)) / 1000)) : 0;
    });
    readonly totalSeconds = computed(() => this.historicalSeconds() + this.elapsedSeconds());

    constructor() {
        if (!this.ipc) return;
        this.destroyRef.onDestroy(subscribeTrackingState(this.ipc, snapshot => {
            this.clock.set(Date.now());
            this.snapshot.set(snapshot);
            this.historicalSeconds.set(Math.max(0, (snapshot.workItem?.total_seconds ?? 0) - this.elapsedSeconds()));
        }, error => this.feedback.error(error)));
        const interval = setInterval(() => {
            if (this.activeSlice()) this.clock.set(Date.now());
        }, 1000);
        this.destroyRef.onDestroy(() => clearInterval(interval));
    }

    async start(item: WorkItem, startTime?: string): Promise<void> {
        await this.api.startTracking(item.id, startTime);
    }

    async stop(): Promise<void> {
        await this.api.stopTracking();
    }

}
