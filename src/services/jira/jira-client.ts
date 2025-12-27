import axios, { AxiosInstance } from 'axios';
import { JiraConnectionConfig, JiraIssue, JiraSearchResult, JiraWorklog } from './jira-types';
import { format } from 'date-fns';

export class JiraClient {
    private client: AxiosInstance;

    constructor(config: JiraConnectionConfig) {
        // Enforce https if it's an atlassian.net domain
        let baseURL = config.baseUrl.replace(/\/$/, '');
        if (baseURL.includes('atlassian.net') && !baseURL.startsWith('https://')) {
            baseURL = baseURL.replace(/^http:\/\//, 'https://');
            if (!baseURL.startsWith('https://')) {
                baseURL = `https://${baseURL}`;
            }
        }

        const auth = btoa(`${config.email}:${config.apiToken}`);

        this.client = axios.create({
            baseURL: `${baseURL}/rest/api/3`, // Using API v3 as required by Atlassian
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
        });
        console.log(`[JiraClient] Initialized with Base URL: ${this.client.defaults.baseURL}`);
    }

    async searchIssues(query: string): Promise<JiraIssue[]> {
        // JQL search
        // Note: Using POST /search is generally safer for JQL queries
        const jql = `summary ~ "${query}" OR key = "${query}" ORDER BY updated DESC`;
        try {
            console.log(`[JiraClient] Searching issues with JQL: ${jql}`);
            // Using the new /search/jql endpoint as per Atlassian's migration guide
            const response = await this.client.post<JiraSearchResult>('/search/jql', {
                jql,
                fields: ['summary', 'description', 'status', 'assignee', 'updated'],
                maxResults: 20
            });
            console.log(`[JiraClient] Search response:`, JSON.stringify(response.data, null, 2));
            // The new API might return issues directly, or in a different structure
            const issues = response.data.issues || response.data;
            return Array.isArray(issues) ? issues : [];
        } catch (error: any) {
            console.error(`Jira search failed [${error.config?.method?.toUpperCase()} ${error.config?.baseURL}${error.config?.url}]:`, error.message);
            if (error.response) {
                console.error('Response status:', error.response.status);
                console.error('Response data:', JSON.stringify(error.response.data, null, 2));
            }
            throw error;
        }
    }

    async getData(path: string): Promise<any> {
        return (await this.client.get(path)).data;
    }

    async getWorklogs(issueIdOrKey: string): Promise<JiraWorklog[]> {
        try {
            const response = await this.client.get<{ worklogs: JiraWorklog[] }>(`/issue/${issueIdOrKey}/worklog`);
            return response.data.worklogs;
        } catch (error) {
            console.error('Failed to get worklogs:', error);
            throw error;
        }
    }

    async addWorklog(issueIdOrKey: string, worklog: {
        comment?: string;
        started: string; // ISO 8601
        timeSpentSeconds: number;
    }): Promise<JiraWorklog> {
        try {
            // Atlassian documentation specifies: yyyy-MM-dd'T'HH:mm:ss.SSSZ
            // Example: 2021-01-12T14:46:25.000+0000
            // date-fns 'XX' format gives +0000
            const startedDate = new Date(worklog.started);
            const formattedStarted = format(startedDate, "yyyy-MM-dd'T'HH:mm:ss.SSSXXXX");

            // Enforce minimum of 60 seconds (Jira requirement in many instances)
            const timeSpentSeconds = Math.max(60, worklog.timeSpentSeconds);

            const payload: any = {
                started: formattedStarted,
                timeSpentSeconds: timeSpentSeconds,
            };

            if (worklog.comment) {
                payload.comment = {
                    version: 1,
                    type: "doc",
                    content: [
                        {
                            type: "paragraph",
                            content: [
                                {
                                    type: "text",
                                    text: worklog.comment
                                }
                            ]
                        }
                    ]
                };
            }

            const response = await this.client.post<JiraWorklog>(`/issue/${issueIdOrKey}/worklog`, payload);
            return response.data;
        } catch (error: any) {
            console.error('Failed to add worklog:', error);
            if (error.response) {
                console.error('Response status:', error.response.status);
                console.error('Response data:', JSON.stringify(error.response.data, null, 2));
            }
            throw error;
        }
    }

    async getCurrentUser(): Promise<any> {
        try {
            return await this.getData('/myself');
        } catch (error) {
            console.error('Failed to get current user:', error);
            throw error;
        }
    }
}
