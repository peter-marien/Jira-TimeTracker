import { useState, useEffect } from 'react';
import { AwayTimeDialog } from '@/components/Tracking/AwayTimeDialog';
import { WorkItem } from '@/lib/api';

export function AwayDialogPage() {
    const [data, setData] = useState<{
        awayStartTime: string;
        awayDurationSeconds: number;
        currentWorkItem: WorkItem | null;
    } | null>(null);

    useEffect(() => {
        // Signal that the window is ready to receive data
        window.ipcRenderer.send('away-window:ready');

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const handleData = (_event: any, payload: {
            awayStartTime: string;
            awayDurationSeconds: number;
            currentWorkItem: WorkItem | null;
        }) => {
            console.log('[AwayDialogPage] Received data:', payload);
            setData(payload);
        };

        window.ipcRenderer.on('away:data', handleData);

        return () => {
            window.ipcRenderer.removeListener('away:data', handleData);
        };
    }, []);

    const handleAction = (action: 'discard' | 'keep' | 'reassign', targetWorkItem?: WorkItem) => {
        if (!data) return;

        // Send action back to main process
        window.ipcRenderer.send('away:action', {
            action,
            awayStartTime: data.awayStartTime,
            targetWorkItem
        });
    };

    if (!data) return <div className="flex items-center justify-center h-screen bg-background text-foreground text-sm">Loading...</div>;

    return (
        <div className="h-screen w-screen bg-background">
            <AwayTimeDialog
                open={true}
                onOpenChange={(isOpen) => {
                    if (!isOpen) {
                        // User cancelled/closed the dialog -> default to 'keep' (do nothing special)
                        window.ipcRenderer.send('away:action', {
                            action: 'keep',
                            awayStartTime: data.awayStartTime
                        });
                    }
                }}
                awayDurationSeconds={data.awayDurationSeconds}
                awayStartTime={data.awayStartTime}
                currentWorkItem={data.currentWorkItem}
                onAction={handleAction}
                contentClassName="sm:max-w-none w-full"
            />
        </div>
    );
}
