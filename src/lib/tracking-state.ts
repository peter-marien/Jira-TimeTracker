import type { TimeSlice, WorkItem } from './api';

export interface TrackingSnapshot {
    revision: number;
    activeSlice: TimeSlice | null;
    workItem: WorkItem | null;
}

export interface TrackingData {
    isTracking: boolean;
    elapsedSeconds: number;
    jiraKey?: string | null;
    description: string;
    startTime?: string;
}

export function toTrackingData(snapshot: TrackingSnapshot): TrackingData {
    const { activeSlice, workItem } = snapshot;
    if (!activeSlice || !workItem) {
        return { isTracking: false, elapsedSeconds: 0, description: '' };
    }
    return {
        isTracking: true,
        elapsedSeconds: Math.max(0, Math.floor((Date.now() - new Date(activeSlice.start_time).getTime()) / 1000)),
        jiraKey: workItem.jira_key,
        description: workItem.description,
        startTime: activeSlice.start_time
    };
}

interface TrackingTransport {
    on(channel: string, listener: (event: unknown, snapshot: TrackingSnapshot) => void): () => void;
    invoke(channel: string): Promise<unknown>;
}

// Subscribe before fetching, then discard responses older than an observed event.
export function subscribeTrackingState(
    ipc: TrackingTransport,
    receive: (snapshot: TrackingSnapshot) => void,
    onError: (error: unknown) => void
) {
    let disposed = false;
    let revision = -1;
    const accept = (snapshot: TrackingSnapshot) => {
        if (disposed || snapshot.revision <= revision) return;
        revision = snapshot.revision;
        receive(snapshot);
    };
    const listener = (_event: unknown, snapshot: TrackingSnapshot) => accept(snapshot);
    const unsubscribe = ipc.on('tracking:state', listener);
    void ipc.invoke('tracking:get-state').then(value => accept(value as TrackingSnapshot)).catch(error => {
        if (!disposed) onError(error);
    });
    return () => {
        disposed = true;
        unsubscribe();
    };
}
