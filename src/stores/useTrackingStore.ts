import { create } from 'zustand'
import { WorkItem, api } from '@/lib/api'
import { formatISO } from 'date-fns'

interface TrackingStore {
    activeWorkItem: WorkItem | null;
    activeTimeSliceId: number | null;
    startTime: string | null; // ISO string
    elapsedSeconds: number;

    startTracking: (workItem: WorkItem) => Promise<void>;
    stopTracking: () => Promise<void>;
    tick: () => void; // Update elapsed time
    setElapsedSeconds: (seconds: number) => void;

    // Initialize from DB if possible? 
    // We'll need a way to check if tracking is active on load.
    checkActiveTracking: () => Promise<void>;
}

export const useTrackingStore = create<TrackingStore>((set, get) => ({
    activeWorkItem: null,
    activeTimeSliceId: null,
    startTime: null,
    elapsedSeconds: 0,

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

        set({
            activeWorkItem: workItem,
            activeTimeSliceId: slice.id,
            startTime: now,
            elapsedSeconds: 0
        });

        // Notify main process for tray update
        api.setTrayIcon('active', workItem.description);
        api.setTrayTooltip(`Tracking: ${workItem.description}`);
    },

    stopTracking: async () => {
        const { activeTimeSliceId, activeWorkItem } = get();
        if (!activeTimeSliceId) return;

        const now = formatISO(new Date());
        await api.saveTimeSlice({
            id: activeTimeSliceId,
            work_item_id: activeWorkItem!.id,
            start_time: get().startTime!,
            end_time: now
        });

        // Reset tray
        api.setTrayIcon('idle');
        api.setTrayTooltip('Jira Time Tracker');

        set({
            activeWorkItem: null,
            activeTimeSliceId: null,
            startTime: null,
            elapsedSeconds: 0
        });
    },

    tick: () => {
        const { startTime } = get();
        if (startTime) {
            const start = new Date(startTime).getTime();
            const now = Date.now();
            set({ elapsedSeconds: Math.floor((now - start) / 1000) });
        }
    },

    checkActiveTracking: async () => {
        // Logic to find open time slice from DB
        // const slices = await api.getTimeSlices(veryOldDate, futureDate);
        // Filter for end_time IS NULL
        // For now we assume we start fresh or persist state in localStorage?
        // DB is single source of truth for "active" (end_time is null).

        // We need an API method: api.getActiveTimeSlice()
        // I haven't implemented it in handlers yet, but I can use getTimeSlices with null check if I implement it.
        // Or just a specific query `SELECT * FROM time_slices WHERE end_time IS NULL LIMIT 1`
    }
}))
