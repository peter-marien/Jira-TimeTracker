import { useEffect, useState } from 'react';
import { StopCircle, Maximize2 } from 'lucide-react';

interface TrackingData {
    isTracking: boolean;
    elapsedSeconds: number;
    jiraKey?: string | null;
    description: string;
}

function formatTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}



export function MiniPlayerApp() {
    const [trackingData, setTrackingData] = useState<TrackingData | null>(null);

    useEffect(() => {
        const handleState = (_event: unknown, data: TrackingData) => {
            setTrackingData(data);
        };

        window.ipcRenderer.on('mini-player:state', handleState);

        return () => {
            window.ipcRenderer.removeListener('mini-player:state', handleState);
        };
    }, []);

    const handleStop = (e: React.MouseEvent) => {
        e.stopPropagation();
        window.ipcRenderer.send('mini-player:stop-tracking');
    };

    const handleExpand = (e: React.MouseEvent) => {
        e.stopPropagation();
        window.ipcRenderer.send('mini-player:expand');
    };

    const handleClick = () => {
        window.ipcRenderer.send('mini-player:expand');
    };

    if (!trackingData || !trackingData.isTracking) {
        return null;
    }

    return (
        <div className="mini-player" onClick={handleClick}>
            <div className="mini-player-content">
                {/* Pulse indicator */}
                <div className="pulse-container">
                    <span className="pulse-outer"></span>
                    <span className="pulse-inner"></span>
                </div>

                {/* Time display */}
                <div className="time-display">
                    {formatTime(trackingData.elapsedSeconds)}
                </div>

                {/* Divider */}
                <div className="divider"></div>

                {/* Work item info */}
                <div className="work-info">
                    {trackingData.jiraKey && (
                        <span className="jira-key">{trackingData.jiraKey}</span>
                    )}
                    <span className="description" title={trackingData.description}>
                        {trackingData.description}
                    </span>
                </div>

                {/* Buttons */}
                <div className="button-group no-drag">
                    <button className="mini-btn expand-btn" onClick={handleExpand} title="Expand">
                        <Maximize2 size={14} />
                    </button>
                    <button className="mini-btn stop-btn" onClick={handleStop} title="Stop">
                        <StopCircle size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
}
