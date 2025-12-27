import { useTrackingStore } from "@/stores/useTrackingStore"
import { Button } from "@/components/ui/button"
import { StopCircle } from "lucide-react"
import { DurationDisplay } from "@/components/shared/DurationDisplay"
import { useEffect } from "react"
import { api } from "@/lib/api"

export function ActiveTrackingBanner() {
    const { activeWorkItem, activeTimeSliceId, elapsedSeconds, stopTracking, tick, startTime, setElapsedSeconds } = useTrackingStore();

    // Timer tick effect
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (activeTimeSliceId) {
            interval = setInterval(tick, 1000);
        }
        return () => clearInterval(interval);
    }, [activeTimeSliceId, tick]);

    // Tray update effect
    useEffect(() => {
        if (!activeWorkItem) return;

        // Set tray tooltip
        // Assuming 'api' is globally available or imported elsewhere for Electron context
        // If not, this line will cause a ReferenceError.
        // For the purpose of this edit, we assume 'api' is available.
        if (typeof api !== 'undefined' && api.setTrayTooltip && api.setTrayIcon) {
            api.setTrayTooltip(`Tracking: ${activeWorkItem.description}`);
            api.setTrayIcon('active');
        }


        // This interval logic seems to duplicate the 'tick' logic from the store.
        // If 'tick' already updates elapsedSeconds, this might be redundant or conflicting.
        // For faithful application of the change, it's included as requested.
        const interval = setInterval(() => {
            if (startTime) { // Ensure startTime is not null/undefined
                const now = new Date();
                const start = new Date(startTime);
                const seconds = Math.floor((now.getTime() - start.getTime()) / 1000);
                setElapsedSeconds(seconds);
            }
        }, 1000);

        return () => {
            clearInterval(interval);
            if (typeof api !== 'undefined' && api.setTrayTooltip && api.setTrayIcon) {
                api.setTrayTooltip('Jira Time Tracker');
                api.setTrayIcon('idle');
            }
        };
    }, [activeWorkItem, startTime, setElapsedSeconds]); // Dependencies for the new effect

    if (!activeWorkItem) return null;

    return (
        <div className="bg-primary text-primary-foreground px-4 py-3 flex items-center justify-between shadow-lg animate-in slide-in-from-top duration-300">
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                    <span className="animate-pulse relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
                    </span>
                    <span className="font-semibold tracking-wide">Tracking</span>
                </div>

                <div className="h-4 w-px bg-primary-foreground/20 mx-2" />

                <div className="flex items-center gap-3">
                    <span className="font-medium">{activeWorkItem.description}</span>
                    {activeWorkItem.jira_key && (
                        <span className="bg-white/10 px-2 py-0.5 rounded text-xs font-mono font-medium">
                            {activeWorkItem.jira_key}
                        </span>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-6">
                <DurationDisplay seconds={elapsedSeconds} className="text-2xl font-bold font-mono tracking-widest" />

                <Button
                    onClick={() => stopTracking()}
                    variant="secondary"
                    size="sm"
                    className="gap-2 font-semibold shadow-none border-0 hover:bg-white hover:text-emerald-900 transition-colors"
                >
                    <StopCircle className="h-4 w-4 fill-current" />
                    Stop
                </Button>
            </div>
        </div>
    )
}
