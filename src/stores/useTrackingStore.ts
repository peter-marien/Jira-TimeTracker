import { create } from 'zustand'
import { WorkItem, api } from '@/lib/api'
import { formatISO } from 'date-fns'

interface TrackingStore {
    activeWorkItem: WorkItem | null;
    activeTimeSliceId: number | null;
    startTime: string | null; // ISO string
    elapsedSeconds: number;
    totalTimeSpent: number; // Historical + current session
    historicalBase: number; // For internal calculation

    startTracking: (workItem: WorkItem) => Promise<void>;
    stopTracking: () => Promise<void>;
    tick: () => void; // Update elapsed time
    setElapsedSeconds: (seconds: number) => void;
    handleAwayTime: (action: 'discard' | 'keep' | 'reassign', awayStartTime: string, targetWorkItem?: WorkItem) => Promise<void>;

    // Initialize from DB if possible? 
    // We'll need a way to check if tracking is active on load.
    checkActiveTracking: () => Promise<void>;
}

export const useTrackingStore = create<TrackingStore>((set, get) => ({
    activeWorkItem: null,
    activeTimeSliceId: null,
    startTime: null,
    elapsedSeconds: 0,
    totalTimeSpent: 0,
    historicalBase: 0,

    setElapsedSeconds: (seconds) => set({ elapsedSeconds: seconds }),

    startTracking: async (workItem) => {
        // 1. Stop current if any (handled by UI or logic? Logic here is safer)
        const { activeTimeSliceId, stopTracking } = get();
        if (activeTimeSliceId) {
            await stopTracking();
        }

        const now = formatISO(new Date());
        // 2. Create new time slice in DB
        const slice = await api.saveTimeSlice({
            work_item_id: workItem.id,
            start_time: now,
            end_time: null // Open-ended
        });

        // 3. Fetch initial total seconds from DB (historical)
        const workItems = await api.getWorkItems({ query: workItem.jira_key || workItem.description });
        const freshWorkItem = workItems.find(wi => wi.id === workItem.id);
        const historicalSeconds = freshWorkItem?.total_seconds || 0;

        set({
            activeWorkItem: workItem,
            activeTimeSliceId: slice.id,
            startTime: now,
            elapsedSeconds: 0,
            totalTimeSpent: historicalSeconds,
            historicalBase: historicalSeconds
        });

        // Notify main process for tray update
        api.setTrayIcon('active', workItem.description);
        api.setTrayTooltip(`Tracking: ${workItem.description}`);
    },

    stopTracking: async () => {
        const { activeTimeSliceId, activeWorkItem, startTime } = get();
        if (!activeTimeSliceId || !startTime) return;

        let finalStartTime = startTime;
        let finalEndTime = formatISO(new Date());

        // Apply time rounding if enabled
        try {
            const settings = await api.getSettings();
            if (settings.rounding_enabled === 'true') {
                const intervalMinutes = parseInt(settings.rounding_interval || '15', 10);
                const intervalMs = intervalMinutes * 60 * 1000;

                if (intervalMs > 0) {
                    const originalStart = new Date(startTime);
                    const originalEnd = new Date();

                    // Round Start Down
                    const roundedStartMs = Math.floor(originalStart.getTime() / intervalMs) * intervalMs;
                    // Round End Up
                    let roundedEndMs = Math.ceil(originalEnd.getTime() / intervalMs) * intervalMs;

                    // Ensure minimum duration is 1 interval
                    if (roundedEndMs - roundedStartMs < intervalMs) {
                        roundedEndMs = roundedStartMs + intervalMs;
                    }

                    finalStartTime = formatISO(new Date(roundedStartMs));
                    finalEndTime = formatISO(new Date(roundedEndMs));

                    console.log(`[TimeRounding] Original: ${startTime} - ${formatISO(originalEnd)}`);
                    console.log(`[TimeRounding] Rounded:  ${finalStartTime} - ${finalEndTime} (Interval: ${intervalMinutes}m)`);
                }
            }
        } catch (err) {
            console.error('[TimeRounding] Failed to apply rounding:', err);
        }

        await api.saveTimeSlice({
            id: activeTimeSliceId,
            work_item_id: activeWorkItem!.id,
            start_time: finalStartTime,
            end_time: finalEndTime
        });

        // Reset tray
        api.setTrayIcon('idle');
        api.setTrayTooltip('Jira Time Tracker');

        set({
            activeWorkItem: null,
            activeTimeSliceId: null,
            startTime: null,
            elapsedSeconds: 0,
            totalTimeSpent: 0,
            historicalBase: 0
        });
    },

    tick: () => {
        const { startTime } = get();
        if (startTime) {
            const start = new Date(startTime).getTime();
            const now = Date.now();
            const elapsed = Math.floor((now - start) / 1000);

            // We need to know the historical time to add to elapsed
            // But totalTimeSpent in state is actually already updated if we do it right.
            // Actually, let's keep totalTimeSpent as the "running total" including current session.
            // To do that, we need to know the historical base.
            set((state) => {
                const historicalBase = state.activeWorkItem?.total_seconds || 0;
                // If the freshWorkItem above already included the current slice (which it might as it's open-ended),
                // we need to be careful not to double count.
                // Actually, the freshWorkItem fetch in startTracking happens right after saveTimeSlice.
                // The SQL sum(now - start) for an open slice will be roughly 0 at that moment.
                return {
                    elapsedSeconds: elapsed,
                    totalTimeSpent: historicalBase + elapsed
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
            const newSlice = await api.saveTimeSlice({
                work_item_id: activeWorkItem.id,
                start_time: now,
                end_time: null
            });

            // Fetch updated historical seconds
            const workItems = await api.getWorkItems({ query: activeWorkItem.jira_key || activeWorkItem.description });
            const freshWorkItem = workItems.find(wi => wi.id === activeWorkItem.id);
            const historicalSeconds = freshWorkItem?.total_seconds || 0;

            set({
                activeTimeSliceId: newSlice.id,
                startTime: now,
                elapsedSeconds: 0,
                totalTimeSpent: historicalSeconds,
                historicalBase: historicalSeconds
            });
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
            const newSlice = await api.saveTimeSlice({
                work_item_id: activeWorkItem.id,
                start_time: now,
                end_time: null
            });

            // Fetch updated historical seconds
            const workItems = await api.getWorkItems({ query: activeWorkItem.jira_key || activeWorkItem.description });
            const freshWorkItem = workItems.find(wi => wi.id === activeWorkItem.id);
            const historicalSeconds = freshWorkItem?.total_seconds || 0;

            set({
                activeTimeSliceId: newSlice.id,
                startTime: now,
                elapsedSeconds: 0,
                totalTimeSpent: historicalSeconds,
                historicalBase: historicalSeconds
            });
        }
    },

    checkActiveTracking: async () => {
        const activeSlice = await api.getActiveTimeSlice();

        if (activeSlice) {
            // Need to get work item details too
            const workItems = await api.getWorkItems({});
            const workItem = workItems.find(wi => wi.id === activeSlice.work_item_id);

            if (workItem) {
                const elapsed = Math.floor((Date.now() - new Date(activeSlice.start_time).getTime()) / 1000);
                const totalIncludingActive = workItem.total_seconds || 0;
                const historicalBase = Math.max(0, totalIncludingActive - elapsed);

                set({
                    activeWorkItem: workItem,
                    activeTimeSliceId: activeSlice.id,
                    startTime: activeSlice.start_time,
                    elapsedSeconds: elapsed,
                    totalTimeSpent: historicalBase + elapsed,
                    historicalBase: historicalBase
                });

                // Update tray
                api.setTrayIcon('active', workItem.description);
                api.setTrayTooltip(`Tracking: ${workItem.description}`);
            }
        } else {
            set({
                activeWorkItem: null,
                activeTimeSliceId: null,
                startTime: null,
                elapsedSeconds: 0
            });
            api.setTrayIcon('idle');
            api.setTrayTooltip('Jira Time Tracker');
        }
    }
}))
