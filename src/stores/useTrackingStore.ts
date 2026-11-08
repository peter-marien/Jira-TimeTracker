import { create } from 'zustand'
import { WorkItem, api } from '@/lib/api'
import { formatISO } from 'date-fns'
import { roundToNearestInterval } from '@/lib/time-utils'
import type { TrackingSnapshot } from '@/lib/tracking-state'

interface TrackingStore {
    revision: number;
    applyTrackingSnapshot: (snapshot: TrackingSnapshot) => void;
    activeWorkItem: WorkItem | null;
    activeTimeSliceId: number | null;
    startTime: string | null; // ISO string
    elapsedSeconds: number;
    totalTimeSpent: number; // Historical + current session
    historicalBase: number; // For internal calculation

    startTracking: (workItem: WorkItem, overrideStartTime?: string) => Promise<void>;
    stopTracking: () => Promise<string | null>; // Returns the (possibly rounded) final end time
    tick: () => void; // Update elapsed time
    setElapsedSeconds: (seconds: number) => void;
    handleAwayTime: (action: 'discard' | 'keep' | 'reassign', awayStartTime: string, targetWorkItem?: WorkItem) => Promise<void>;

    updateActiveWorkItem: (workItem: WorkItem) => Promise<void>;

    // Initialize from DB if possible? 
    // We'll need a way to check if tracking is active on load.
    checkActiveTracking: () => Promise<void>;
}

export const useTrackingStore = create<TrackingStore>((set, get) => ({
    revision: -1,
    activeWorkItem: null,
    activeTimeSliceId: null,
    startTime: null,
    elapsedSeconds: 0,
    totalTimeSpent: 0,
    historicalBase: 0,

    setElapsedSeconds: (seconds) => set({ elapsedSeconds: seconds }),

    startTracking: async (workItem, overrideStartTime) => {
        // 1. Stop current if any (handled by UI or logic? Logic here is safer)
        const { activeTimeSliceId, stopTracking } = get();
        let startTimeToUse = overrideStartTime;

        if (activeTimeSliceId) {
            // stopTracking returns the rounded end time of the stopped slice
            const roundedEndTime = await stopTracking();
            if (roundedEndTime && !overrideStartTime) {
                // Use the rounded end time as the start of the new slice
                startTimeToUse = roundedEndTime;
            }
        }

        // 2. If no overrideStartTime was provided (and no slice was stopped), apply rounding to current time
        if (!startTimeToUse) {
            const now = new Date();
            try {
                const settings = await api.getSettings();
                if (settings.rounding_enabled === 'true') {
                    const intervalMinutes = parseInt(settings.rounding_interval || '15', 10);
                    const roundedStart = roundToNearestInterval(now, intervalMinutes);
                    startTimeToUse = formatISO(roundedStart);
                    console.log(`[TimeRounding] New slice start rounded from ${formatISO(now)} to ${startTimeToUse} (Interval: ${intervalMinutes}m)`);
                } else {
                    startTimeToUse = formatISO(now);
                }
            } catch (err) {
                console.error('[TimeRounding] Failed to get settings for start rounding:', err);
                startTimeToUse = formatISO(now);
            }
        }

        // 3. Create new time slice in DB
        await api.saveTimeSlice({
            work_item_id: workItem.id,
            start_time: startTimeToUse,
            end_time: null // Open-ended
        });

        await get().checkActiveTracking();
    },

    stopTracking: async () => {
        const endTime = await api.stopTracking();
        await get().checkActiveTracking();
        return endTime;
    },

    tick: () => {
        const { startTime } = get();
        if (startTime) {
            const start = new Date(startTime).getTime();
            const now = Date.now();
            const elapsed = Math.max(0, Math.floor((now - start) / 1000));

            // We need to know the historical time to add to elapsed
            // But totalTimeSpent in state is actually already updated if we do it right.
            // Actually, let's keep totalTimeSpent as the "running total" including current session.
            // To do that, we need to know the historical base.
            set((state) => {
                return {
                    elapsedSeconds: elapsed,
                    totalTimeSpent: state.historicalBase + elapsed
                };
            });
        }
    },

    handleAwayTime: async (action, awayStartTime, targetWorkItem) => {
        const { activeTimeSliceId, activeWorkItem, startTime } = get();
        if (!activeTimeSliceId || !activeWorkItem || !startTime) return;

        if (action === 'keep') {
            // Do nothing - time is already included in the current slice
            return;
        }

        if (action === 'discard') {
            // End the current slice at awayStartTime, then start a new one from now
            await api.saveTimeSlice({
                id: activeTimeSliceId,
                work_item_id: activeWorkItem.id,
                start_time: startTime,
                end_time: awayStartTime
            });

            // Start a new slice from now
            const now = formatISO(new Date());
            await api.saveTimeSlice({
                work_item_id: activeWorkItem.id,
                start_time: now,
                end_time: null
            });

            await get().checkActiveTracking();
            return;
        }

        if (action === 'reassign' && targetWorkItem) {
            // End the current slice at awayStartTime
            await api.saveTimeSlice({
                id: activeTimeSliceId,
                work_item_id: activeWorkItem.id,
                start_time: startTime,
                end_time: awayStartTime
            });

            // Create a new slice for the away time assigned to targetWorkItem
            const now = formatISO(new Date());
            await api.saveTimeSlice({
                work_item_id: targetWorkItem.id,
                start_time: awayStartTime,
                end_time: now
            });

            // Start a new slice from now for the original work item
            await api.saveTimeSlice({
                work_item_id: activeWorkItem.id,
                start_time: now,
                end_time: null
            });

            await get().checkActiveTracking();
        }
    },

    updateActiveWorkItem: async () => {
        await get().checkActiveTracking();
    },

    applyTrackingSnapshot: (snapshot) => {
        if (snapshot.revision < get().revision) return;
        const { activeSlice, workItem } = snapshot;
        if (activeSlice && workItem) {
            const elapsed = Math.max(0, Math.floor((Date.now() - new Date(activeSlice.start_time).getTime()) / 1000));
            const historicalBase = Math.max(0, (workItem.total_seconds || 0) - elapsed);
            set({
                revision: snapshot.revision,
                activeWorkItem: workItem,
                activeTimeSliceId: activeSlice.id,
                startTime: activeSlice.start_time,
                elapsedSeconds: elapsed,
                totalTimeSpent: historicalBase + elapsed,
                historicalBase
            });
        } else {
            set({
                revision: snapshot.revision,
                activeWorkItem: null,
                activeTimeSliceId: null,
                startTime: null,
                elapsedSeconds: 0,
                totalTimeSpent: 0,
                historicalBase: 0
            });
        }
    },

    checkActiveTracking: async () => {
        const snapshot = await api.getTrackingSnapshot();
        get().applyTrackingSnapshot(snapshot);
    }
}))
