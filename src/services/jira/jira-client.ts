import axios, { AxiosInstance } from 'axios';
import { format } from 'date-fns';

export interface JiraConfig {
    baseUrl: string;
    email: string;
    apiToken: string;
}

export interface JiraWorklog {
    id: string;
    issueId: string;
    timeSpentSeconds: number;
    started: string;
    comment?: any;
}

export class JiraClient {
    private client: AxiosInstance;

    constructor(config: JiraConfig) {
        // Enforce HTTPS for atlassian.net domains
        let baseUrl = config.baseUrl;
        if (baseUrl.includes('atlassian.net') && !baseUrl.startsWith('https://')) {
            baseUrl = baseUrl.replace(/^http:\/\//, 'https://');
        }

        this.client = axios.create({
            baseURL: `${baseUrl}/rest/api/3`,
            auth: {
                username: config.email,
                password: config.apiToken
            },
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }

    async searchIssues(jql: string): Promise<any[]> {
        try {
            console.log(`[JiraClient] Searching with JQL: ${jql}`);
            const response = await this.client.post('/search/jql', {
                jql,
                fields: ['summary', 'description', 'status', 'assignee', 'updated'],
                maxResults: 20
            });
            console.log(`[JiraClient] Search response:`, JSON.stringify(response.data, null, 2));
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
            const startedDate = new Date(worklog.started);
            const formattedStarted = format(startedDate, "yyyy-MM-dd'T'HH:mm:ss.SSSXXXX");
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

    async updateWorklog(issueIdOrKey: string, worklogId: string, worklog: {
        comment?: string;
        started: string;
        timeSpentSeconds: number;
    }): Promise<JiraWorklog> {
        try {
            const startedDate = new Date(worklog.started);
            const formattedStarted = format(startedDate, "yyyy-MM-dd'T'HH:mm:ss.SSSXXXX");
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

            console.log(`[JiraClient] Updating worklog ${worklogId} on ${issueIdOrKey}`);
            const response = await this.client.put<JiraWorklog>(`/issue/${issueIdOrKey}/worklog/${worklogId}`, payload);
            return response.data;
        } catch (error: any) {
            console.error(`[JiraClient] Failed to update worklog ${worklogId}:`, error);
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
