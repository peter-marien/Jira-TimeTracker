import axios, { AxiosInstance } from 'axios';
import { JiraConnectionConfig, JiraIssue, JiraSearchResult, JiraWorklog } from './jira-types';

export class JiraClient {
    private client: AxiosInstance;

    constructor(config: JiraConnectionConfig) {
        const baseURL = config.baseUrl.replace(/\/$/, ''); // Remove trailing slash
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
            // Jira API v3 expects ADF for comments usually, but simple string might not work in v3 directly without specific structure.
            // However, v2 allows strings. Some instances support both.
            // For v3, use specific structure or try sending simple object.
            // To be safe, we will create a text ADF structure if comment is provided.

            const payload: any = {
                started: worklog.started,
                timeSpentSeconds: worklog.timeSpentSeconds,
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
        } catch (error) {
            console.error('Failed to add worklog:', error);
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
