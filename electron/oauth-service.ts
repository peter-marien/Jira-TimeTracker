import { shell, BrowserWindow } from 'electron';
import axios from 'axios';
import { encrypt, decrypt } from './crypto-service';
import { getDatabase } from '../src/database/db';

// Atlassian OAuth 2.0 endpoints
const ATLASSIAN_AUTH_URL = 'https://auth.atlassian.com/authorize';
const ATLASSIAN_TOKEN_URL = 'https://auth.atlassian.com/oauth/token';
const ATLASSIAN_RESOURCES_URL = 'https://api.atlassian.com/oauth/token/accessible-resources';

// OAuth scopes required for Jira operations
const OAUTH_SCOPES = [
    'read:jira-work',
    'write:jira-work',
    'read:jira-user',
    'offline_access'
].join(' ');

// Custom URL scheme for callback
const CALLBACK_URL = 'jira-timetracker-app://oauth/callback';

// Store pending OAuth state
interface PendingOAuth {
    connectionId: number | null; // null for new connections
    clientId: string;
    clientSecret: string;
    state: string;
    resolve: (result: OAuthResult) => void;
    reject: (error: Error) => void;
}

export interface OAuthResult {
    success: boolean;
    accessToken?: string;
    refreshToken?: string;
    expiresIn?: number;
    cloudId?: string;
    siteName?: string;
    siteUrl?: string;
    error?: string;
}

interface AccessibleResource {
    id: string;
    name: string;
    url: string;
    scopes: string[];
    avatarUrl?: string;
}

let pendingOAuth: PendingOAuth | null = null;

/**
 * Generates a random state string for OAuth CSRF protection
 */
function generateState(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 32; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

/**
 * Starts the OAuth authorization flow by opening the browser
 */
export function startOAuthFlow(
    clientId: string,
    clientSecret: string,
    connectionId: number | null = null
): Promise<OAuthResult> {
    return new Promise((resolve, reject) => {
        const state = generateState();

        // Store pending OAuth info
        pendingOAuth = {
            connectionId,
            clientId,
            clientSecret,
            state,
            resolve,
            reject
        };

        // Build authorization URL
        const params = new URLSearchParams({
            audience: 'api.atlassian.com',
            client_id: clientId,
            scope: OAUTH_SCOPES,
            redirect_uri: CALLBACK_URL,
            state: state,
            response_type: 'code',
            prompt: 'consent'
        });

        const authUrl = `${ATLASSIAN_AUTH_URL}?${params.toString()}`;

        console.log('[OAuth] Opening authorization URL:', authUrl);

        // Open in default browser
        shell.openExternal(authUrl).catch(err => {
            console.error('[OAuth] Failed to open browser:', err);
            pendingOAuth = null;
            reject(new Error('Failed to open browser for authorization'));
        });
    });
}

/**
 * Handles the OAuth callback URL
 */
export async function handleOAuthCallback(callbackUrl: string): Promise<void> {
    console.log('[OAuth] Handling callback:', callbackUrl);

    if (!pendingOAuth) {
        console.error('[OAuth] No pending OAuth flow');
        return;
    }

    try {
        const url = new URL(callbackUrl);
        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');
        const error = url.searchParams.get('error');
        const errorDescription = url.searchParams.get('error_description');

        // Verify state to prevent CSRF
        if (state !== pendingOAuth.state) {
            throw new Error('Invalid state parameter - possible CSRF attack');
        }

        if (error) {
            throw new Error(errorDescription || error);
        }

        if (!code) {
            throw new Error('No authorization code received');
        }

        // Exchange code for tokens
        const tokenResult = await exchangeCodeForTokens(
            code,
            pendingOAuth.clientId,
            pendingOAuth.clientSecret
        );

        // Get accessible Jira resources
        const resources = await getAccessibleResources(tokenResult.access_token);

        if (resources.length === 0) {
            throw new Error('No accessible Jira sites found. Please ensure you have granted access to at least one Jira site.');
        }

        // Use the first accessible resource (user can have multiple Jira sites)
        const resource = resources[0];

        const result: OAuthResult = {
            success: true,
            accessToken: tokenResult.access_token,
            refreshToken: tokenResult.refresh_token,
            expiresIn: tokenResult.expires_in,
            cloudId: resource.id,
            siteName: resource.name,
            siteUrl: resource.url
        };

        pendingOAuth.resolve(result);

        // Focus the main window
        const windows = BrowserWindow.getAllWindows();
        if (windows.length > 0) {
            const mainWindow = windows.find(w => !w.webContents.getURL().includes('mini-player')) || windows[0];
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }

    } catch (error) {
        console.error('[OAuth] Callback error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error during OAuth';
        pendingOAuth.reject(new Error(errorMessage));
    } finally {
        pendingOAuth = null;
    }
}

/**
 * Exchanges authorization code for access and refresh tokens
 */
async function exchangeCodeForTokens(
    code: string,
    clientId: string,
    clientSecret: string
): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
    console.log('[OAuth] Exchanging code for tokens');

    const response = await axios.post(ATLASSIAN_TOKEN_URL, {
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        redirect_uri: CALLBACK_URL
    }, {
        headers: {
            'Content-Type': 'application/json'
        }
    });

    return response.data;
}

/**
 * Gets the list of Jira sites the user has authorized access to
 */
async function getAccessibleResources(accessToken: string): Promise<AccessibleResource[]> {
    console.log('[OAuth] Getting accessible resources');

    const response = await axios.get(ATLASSIAN_RESOURCES_URL, {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json'
        }
    });

    return response.data;
}

/**
 * Refreshes an expired access token using the refresh token
 */
export async function refreshAccessToken(connectionId: number): Promise<string> {
    const db = getDatabase();

    const conn = db.prepare(`
        SELECT client_id, client_secret_encrypted, refresh_token_encrypted 
        FROM jira_connections 
        WHERE id = ?
    `).get(connectionId) as {
        client_id: string;
        client_secret_encrypted: string;
        refresh_token_encrypted: string;
    } | undefined;

    if (!conn) {
        throw new Error('Connection not found');
    }

    const clientSecret = decrypt(conn.client_secret_encrypted);
    const refreshToken = decrypt(conn.refresh_token_encrypted);

    console.log('[OAuth] Refreshing access token for connection:', connectionId);

    const response = await axios.post(ATLASSIAN_TOKEN_URL, {
        grant_type: 'refresh_token',
        client_id: conn.client_id,
        client_secret: clientSecret,
        refresh_token: refreshToken
    }, {
        headers: {
            'Content-Type': 'application/json'
        }
    });

    const { access_token, refresh_token, expires_in } = response.data;
    const expiresAt = Math.floor(Date.now() / 1000) + expires_in;

    // Update tokens in database
    db.prepare(`
        UPDATE jira_connections 
        SET access_token_encrypted = ?, 
            refresh_token_encrypted = ?,
            token_expires_at = ?,
            updated_at = unixepoch()
        WHERE id = ?
    `).run(
        encrypt(access_token),
        encrypt(refresh_token),
        expiresAt,
        connectionId
    );

    return access_token;
}

/**
 * Gets a valid access token for a connection, refreshing if necessary
 */
export async function getValidAccessToken(connectionId: number): Promise<string> {
    const db = getDatabase();

    const conn = db.prepare(`
        SELECT access_token_encrypted, token_expires_at 
        FROM jira_connections 
        WHERE id = ? AND auth_type = 'oauth'
    `).get(connectionId) as {
        access_token_encrypted: string;
        token_expires_at: number;
    } | undefined;

    if (!conn) {
        throw new Error('OAuth connection not found');
    }

    const now = Math.floor(Date.now() / 1000);
    const bufferSeconds = 300; // Refresh 5 minutes before expiry

    if (conn.token_expires_at - bufferSeconds <= now) {
        console.log('[OAuth] Token expired or expiring soon, refreshing...');
        return await refreshAccessToken(connectionId);
    }

    return decrypt(conn.access_token_encrypted);
}

/**
 * Saves OAuth tokens to a connection
 */
export function saveOAuthTokens(
    connectionId: number,
    clientId: string,
    clientSecret: string,
    accessToken: string,
    refreshToken: string,
    expiresIn: number,
    cloudId: string
): void {
    const db = getDatabase();
    const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;

    db.prepare(`
        UPDATE jira_connections 
        SET auth_type = 'oauth',
            client_id = ?,
            client_secret_encrypted = ?,
            access_token_encrypted = ?,
            refresh_token_encrypted = ?,
            token_expires_at = ?,
            cloud_id = ?,
            updated_at = unixepoch()
        WHERE id = ?
    `).run(
        clientId,
        encrypt(clientSecret),
        encrypt(accessToken),
        encrypt(refreshToken),
        expiresAt,
        cloudId,
        connectionId
    );
}

/**
 * Checks if there's a pending OAuth flow
 */
export function hasPendingOAuth(): boolean {
    return pendingOAuth !== null;
}

/**
 * Cancels any pending OAuth flow
 */
export function cancelPendingOAuth(): void {
    if (pendingOAuth) {
        pendingOAuth.reject(new Error('OAuth flow cancelled'));
        pendingOAuth = null;
    }
}
