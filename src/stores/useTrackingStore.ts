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
        const activeSlice = await api.getActiveTimeSlice();

        if (activeSlice) {
            // Need to get work item details too
            const workItems = await api.getWorkItems();
            const workItem = workItems.find(wi => wi.id === activeSlice.work_item_id);

            if (workItem) {
                set({
                    activeWorkItem: workItem,
                    activeTimeSliceId: activeSlice.id,
                    startTime: activeSlice.start_time,
                    elapsedSeconds: Math.floor((Date.now() - new Date(activeSlice.start_time).getTime()) / 1000)
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
