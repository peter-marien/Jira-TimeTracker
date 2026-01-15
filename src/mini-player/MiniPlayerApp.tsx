import { useEffect, useState, useRef } from 'react';
import { StopCircle, Maximize2, Search, Loader2, Play } from 'lucide-react';

interface TrackingData {
    isTracking: boolean;
    elapsedSeconds: number;
    jiraKey?: string | null;
    description: string;
}

interface WorkItem {
    id: number;
    jira_connection_id?: number | null;
    jira_key?: string | null;
    description: string;
}

interface JiraSearchResult {
    key: string;
    summary: string;
    connectionId: number;
    connectionName: string;
}

interface JiraConnection {
    id: number;
    name: string;
    color?: string;
}

function roundToNearestInterval(date: Date, intervalMinutes: number): Date {
    const result = new Date(date);
    result.setSeconds(0, 0); // Always clear seconds and milliseconds

    if (intervalMinutes <= 1) {
        return result;
    }

    const intervalMs = intervalMinutes * 60 * 1000;
    const timestamp = result.getTime();
    const roundedMs = Math.round(timestamp / intervalMs) * intervalMs;
    return new Date(roundedMs);
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
    const [query, setQuery] = useState("");
    const [localItems, setLocalItems] = useState<WorkItem[]>([]);
    const [jiraItems, setJiraItems] = useState<JiraSearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const [connections, setConnections] = useState<JiraConnection[]>([]);
    const searchRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleState = (_event: unknown, data: TrackingData) => {
            setTrackingData(data);
        };

        window.ipcRenderer.on('mini-player:state', handleState);
        window.ipcRenderer.invoke('db:get-all-connections').then(setConnections);

        return () => {
            window.ipcRenderer.removeListener('mini-player:state', handleState);
        };
    }, []);

    // Handle clicks outside to close search results
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setShowResults(false);
                window.ipcRenderer.send('mini-player:set-search-active', false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Search logic
    useEffect(() => {
        if (!query.trim()) {
            setLocalItems([]);
            setJiraItems([]);
            setShowResults(false);
            window.ipcRenderer.send('mini-player:set-search-active', false);
            return;
        }

        const timer = setTimeout(async () => {
            setLoading(true);
            try {
                const [local, jira] = await Promise.all([
                    window.ipcRenderer.invoke('db:get-work-items', { query }),
                    window.ipcRenderer.invoke('jira:search-issues-all-connections', query).catch(() => [])
                ]);
                setLocalItems(local || []);
                setJiraItems(jira || []);
                setShowResults(true);
                window.ipcRenderer.send('mini-player:set-search-active', true);
            } finally {
                setLoading(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [query]);

    const handleStartTracking = async (workItem: WorkItem) => {
        let startTime = new Date().toISOString();

        try {
            const settings = await window.ipcRenderer.invoke('db:get-settings');
            if (settings.rounding_enabled === 'true') {
                const intervalMinutes = parseInt(settings.rounding_interval || '15', 10);
                const now = new Date();
                const roundedStart = roundToNearestInterval(now, intervalMinutes);
                startTime = roundedStart.toISOString();
                console.log(`[MiniPlayer] Rounded start time from ${now.toISOString()} to ${startTime}`);
            }
        } catch (err) {
            console.error('[MiniPlayer] Failed to apply time rounding:', err);
        }

        await window.ipcRenderer.invoke('db:save-time-slice', {
            work_item_id: workItem.id,
            start_time: startTime,
            notes: ''
        });
        setQuery("");
        setShowResults(false);
        window.ipcRenderer.send('mini-player:set-search-active', false);

        // Update local state to show tracking view immediately
        setTrackingData({
            isTracking: true,
            elapsedSeconds: 0,
            jiraKey: workItem.jira_key,
            description: workItem.description
        });

        // Notify main window to refresh its tracking state
        window.ipcRenderer.send('mini-player:tracking-started', {
            workItemId: workItem.id,
            description: workItem.description,
            jiraKey: workItem.jira_key
        });
    };

    const handleSelectJira = async (jiraItem: JiraSearchResult) => {
        try {
            const newWorkItem = await window.ipcRenderer.invoke('db:save-work-item', {
                jira_connection_id: jiraItem.connectionId,
                jira_key: jiraItem.key,
                description: jiraItem.summary,
            });
            await handleStartTracking(newWorkItem);
        } catch (err) {
            console.error("Failed to start tracking Jira issue:", err);
        }
    };

    const handleStop = (e: React.MouseEvent) => {
        e.stopPropagation();
        window.ipcRenderer.send('mini-player:stop-tracking');
    };

    const handleExpand = (e: React.MouseEvent) => {
        e.stopPropagation();
        window.ipcRenderer.send('mini-player:expand');
    };

    const handleClick = () => {
        if (trackingData?.isTracking) {
            window.ipcRenderer.send('mini-player:expand');
        }
    };

    if (trackingData?.isTracking) {
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

    // Idle State with Search
    return (
        <div className="mini-player idle">
            <div className="mini-player-idle-content">
                {/* Results area (fills available space above search bar) */}
                {showResults && (
                    <div className="search-results-area no-drag" ref={searchRef}>
                        {localItems.length === 0 && jiraItems.length === 0 ? (
                            <div className="no-results">No work items found</div>
                        ) : (
                            <>
                                {localItems.length > 0 && (
                                    <div className="result-group">
                                        <div className="group-label">Local Results</div>
                                        {localItems.map(item => (
                                            <div
                                                key={`local-${item.id}`}
                                                className="result-item"
                                                onClick={() => handleStartTracking(item)}
                                            >
                                                <div className="result-content">
                                                    <div className="result-description">{item.description}</div>
                                                    {item.jira_key && (
                                                        <div className="result-meta">
                                                            <span
                                                                className="result-key"
                                                                style={{ color: connections.find(c => c.id === item.jira_connection_id)?.color }}
                                                            >
                                                                {item.jira_key}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                                <Play size={12} className="start-icon" />
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {jiraItems.length > 0 && (
                                    <div className="result-group">
                                        <div className="group-label">Jira Results</div>
                                        {jiraItems.map(item => (
                                            <div
                                                key={`jira-${item.connectionId}-${item.key}`}
                                                className="result-item"
                                                onClick={() => handleSelectJira(item)}
                                            >
                                                <div className="result-content">
                                                    <div className="result-description">{item.summary}</div>
                                                    <div className="result-meta">
                                                        <span
                                                            className="result-key"
                                                            style={{ color: connections.find(c => c.id === item.connectionId)?.color }}
                                                        >
                                                            {item.key}
                                                        </span>
                                                    </div>
                                                </div>
                                                <Play size={12} className="start-icon" />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}

                {/* Search bar row at bottom */}
                <div className="search-bar-row">
                    <div className="search-input-wrapper no-drag">
                        <Search className="search-icon" size={14} />
                        <input
                            type="text"
                            className="search-input"
                            placeholder="Search to start tracking..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                        />
                        {loading && <Loader2 className="loading-icon animate-spin" size={14} />}
                    </div>
                    <button className="mini-btn expand-btn no-drag" onClick={handleExpand} title="Expand">
                        <Maximize2 size={14} />
                    </button>
                </div>
            </div>
        </div>
    );
}
