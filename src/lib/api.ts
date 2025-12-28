// Type-safe wrapper for IPC calls

export interface WorkItem {
    id: number;
    jira_connection_id?: number | null;
    jira_key?: string | null;
    description: string;
    created_at?: number;
    updated_at?: number;

    // Joined fields
    connection_name?: string;
}

export interface TimeSlice {
    id: number;
    work_item_id: number;
    start_time: string;
    end_time?: string | null;
    notes?: string | null;
    synced_to_jira?: number; // 0 or 1
    jira_worklog_id?: string | null;
    synced_start_time?: string | null;
    synced_end_time?: string | null;
    created_at?: number;
    updated_at?: number;

    // Joined fields
    jira_key?: string;
    work_item_description?: string;
    connection_name?: string;
}

export interface JiraConnection {
    id: number;
    name: string;
    base_url: string;
    email: string;
    api_token: string;
    is_default: number;
}

const ipc = window.ipcRenderer;

export const api = {
    // Jira Connections
    getJiraConnections: () => ipc.invoke('db:get-all-connections') as Promise<JiraConnection[]>,
    saveJiraConnection: (conn: Partial<JiraConnection>) => ipc.invoke('db:save-connection', conn),
    deleteJiraConnection: (id: number) => ipc.invoke('db:delete-connection', id),

    // Work Items
    getWorkItems: (query: string = '') => ipc.invoke('db:get-work-items', query) as Promise<WorkItem[]>,
    saveWorkItem: (item: Partial<WorkItem>) => ipc.invoke('db:save-work-item', item) as Promise<WorkItem>,
    deleteWorkItem: (id: number) => ipc.invoke('db:delete-work-item', id),

    // Time Slices
    getTimeSlices: (startStr: string, endStr: string) => ipc.invoke('db:get-time-slices', { startStr, endStr }),
    getTimeSlice: (id: number) => ipc.invoke('db:get-time-slice', id) as Promise<TimeSlice>,
    saveTimeSlice: (slice: Partial<TimeSlice>) => ipc.invoke('db:save-time-slice', slice) as Promise<TimeSlice>,
    deleteTimeSlice: (id: number) => ipc.invoke('db:delete-time-slice', id),

    // Settings
    getSettings: () => ipc.invoke('db:get-settings'),
    saveSetting: (key: string, value: string) => ipc.invoke('db:save-setting', { key, value }),

    // Jira
    searchJiraIssues: (query: string) => ipc.invoke('jira:search-issues', query),
    addJiraWorklog: (issueKey: string, data: { timeSpentSeconds: number, comment: string, started: string }) =>
        ipc.invoke('jira:add-worklog', { issueKey, ...data }),
    updateJiraWorklog: (issueKey: string, worklogId: string, data: { timeSpentSeconds: number, comment: string, started: string }) =>
        ipc.invoke('jira:update-worklog', { issueKey, worklogId, ...data }),
    getJiraWorklogs: (issueKey: string) => ipc.invoke('jira:get-worklogs', { issueKey }),
    testJiraConnection: (config: { baseUrl: string, email: string, apiToken: string }) => ipc.invoke('jira:test-connection', config),
    getDatabasePath: () => ipc.invoke('database:get-path'),
    selectDatabasePath: () => ipc.invoke('database:select-path'),
    saveDatabasePath: (path: string) => ipc.invoke('database:save-path', path),

    // System
    setTrayTooltip: (text: string) => ipc.invoke('tray:set-tooltip', text),
    setTrayIcon: (type: 'active' | 'idle', description?: string) => ipc.invoke('tray:set-icon', type, description),
};
