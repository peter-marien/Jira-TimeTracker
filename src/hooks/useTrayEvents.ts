import { useEffect } from 'react';
import { useTrackingStore } from '@/stores/useTrackingStore';

export function useTrayEvents() {
    const stopTracking = useTrackingStore(state => state.stopTracking);

    useEffect(() => {
        if (!window.ipcRenderer) {
            console.warn('[Tray] window.ipcRenderer is not defined, skipping listeners');
            return;
        }

        const handler = () => {
            console.log('[Tray] Received stop-tracking command');
            stopTracking();
        };

        window.ipcRenderer.on('tray:stop-tracking', handler);

        return () => {
            window.ipcRenderer.removeListener('tray:stop-tracking', handler);
        };
    }, [stopTracking]);
}
