import { useTrackingStore } from "@/stores/useTrackingStore"
import { Button } from "@/components/ui/button"
import { StopCircle, Clock } from "lucide-react"
import { DurationDisplay } from "@/components/shared/DurationDisplay"
import { useEffect } from "react"

export function ActiveTrackingBanner() {
    const { activeWorkItem, activeTimeSliceId, elapsedSeconds, totalTimeSpent, stopTracking, tick } = useTrackingStore();

    // Timer tick effect
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (activeTimeSliceId) {
            interval = setInterval(tick, 1000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [activeTimeSliceId, tick]);

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
                <div className="flex flex-col items-end">
                    <DurationDisplay seconds={elapsedSeconds} className="text-2xl font-bold font-mono tracking-widest leading-none" />
                    <div className="flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider opacity-70 mt-1">
                        <Clock className="w-3 h-3" />
                        Total: <DurationDisplay seconds={totalTimeSpent} showSeconds={false} />
                    </div>
                </div>

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
