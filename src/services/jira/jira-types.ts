export interface JiraUser {
    accountId: string;
    displayName: string;
    emailAddress?: string;
    avatarUrls?: Record<string, string>;
}

export interface JiraIssue {
    id: string;
    key: string;
    fields: {
        summary: string;
        description?: string; // Often comes as ADF (Atlassian Document Format) or string
        assignee?: JiraUser;
        status: {
            name: string;
            statusCategory: {
                name: string;
                colorName: string;
            };
        };
        updated: string;
    };
}

export interface JiraWorklog {
    id: string;
    author: JiraUser;
    updateAuthor: JiraUser;
    comment?: string | Record<string, unknown>; // ADF
    created: string;
    updated: string;
    started: string;
    timeSpent: string;
    timeSpentSeconds: number;
}

export interface JiraSearchResult {
    expand: string;
    startAt: number;
    maxResults: number;
    total: number;
    issues: JiraIssue[];
}

export interface JiraConnectionConfig {
    baseUrl: string; // e.g., https://your-domain.atlassian.net
    email: string;
    apiToken: string;
}
