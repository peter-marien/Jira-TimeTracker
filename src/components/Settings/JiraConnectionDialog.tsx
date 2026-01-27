import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useState, useEffect } from "react"
import { api, JiraConnection } from "@/lib/api"
import { Checkbox } from "@/components/ui/checkbox"
import { Eye, EyeOff, Loader2, Plug, Palette, KeyRound, ExternalLink, CheckCircle2, X } from "lucide-react"
import { ColorPicker } from "@/components/shared/ColorPicker"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface JiraConnectionDialogProps {
    connection: JiraConnection | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: () => void;
}

export function JiraConnectionDialog({ connection, open, onOpenChange, onSave }: JiraConnectionDialogProps) {
    const [name, setName] = useState("");
    const [baseUrl, setBaseUrl] = useState("");
    const [email, setEmail] = useState("");
    const [apiToken, setApiToken] = useState("");
    const [isDefault, setIsDefault] = useState(false);
    const [color, setColor] = useState("");
    const [isEnabled, setIsEnabled] = useState(true);

    // OAuth state
    const [authType, setAuthType] = useState<'api_token' | 'oauth'>('api_token');
    const [clientId, setClientId] = useState("");
    const [clientSecret, setClientSecret] = useState("");
    const [oauthAuthorized, setOauthAuthorized] = useState(false);
    const [oauthCloudId, setOauthCloudId] = useState("");
    const [oauthSiteUrl, setOauthSiteUrl] = useState("");
    const [oauthTokens, setOauthTokens] = useState<{
        accessTokenEncrypted?: string;
        refreshTokenEncrypted?: string;
        clientSecretEncrypted?: string;
        expiresIn?: number;
    } | null>(null);

    // UI state
    const [showToken, setShowToken] = useState(false);
    const [showClientSecret, setShowClientSecret] = useState(false);
    const [testing, setTesting] = useState(false);
    const [authorizing, setAuthorizing] = useState(false);
    const [testStatus, setTestStatus] = useState<{ success: boolean, message: string } | null>(null);

    useEffect(() => {
        if (open) {
            if (connection) {
                setName(connection.name);
                setBaseUrl(connection.base_url);
                setEmail(connection.email);
                setApiToken(connection.api_token);
                setIsDefault(!!connection.is_default);
                setColor(connection.color || "");
                setIsEnabled(connection.is_enabled !== 0);
                setAuthType(connection.auth_type || 'api_token');
                setClientId(connection.client_id || "");
                setOauthCloudId(connection.cloud_id || "");
                setOauthAuthorized(!!connection.cloud_id && connection.auth_type === 'oauth');
                setOauthSiteUrl("");
            } else {
                setName("");
                setBaseUrl("");
                setEmail("");
                setApiToken("");
                setIsDefault(false);
                setColor("");
                setIsEnabled(true);
                setAuthType('api_token');
                setClientId("");
                setClientSecret("");
                setOauthAuthorized(false);
                setOauthCloudId("");
                setOauthSiteUrl("");
                setOauthTokens(null);
            }
            setTestStatus(null);
            setShowToken(false);
            setShowClientSecret(false);
        }
    }, [connection, open]);

    const handleSave = async () => {
        if (!name) return;

        if (authType === 'oauth') {
            if (!oauthAuthorized && !oauthTokens) {
                setTestStatus({ success: false, message: 'Please authorize with Jira first.' });
                return;
            }

            // Calculate token expiry time
            const tokenExpiresAt = oauthTokens?.expiresIn
                ? Math.floor(Date.now() / 1000) + oauthTokens.expiresIn
                : connection?.token_expires_at;

            await api.saveJiraConnectionOAuth({
                id: connection?.id,
                name,
                base_url: oauthSiteUrl || baseUrl,
                is_default: isDefault ? 1 : 0,
                color: color || undefined,
                is_enabled: isEnabled ? 1 : 0,
                auth_type: 'oauth',
                client_id: clientId,
                client_secret_encrypted: oauthTokens?.clientSecretEncrypted,
                access_token_encrypted: oauthTokens?.accessTokenEncrypted,
                refresh_token_encrypted: oauthTokens?.refreshTokenEncrypted,
                token_expires_at: tokenExpiresAt,
                cloud_id: oauthCloudId
            });
        } else {
            if (!baseUrl || !email || !apiToken) return;

            await api.saveJiraConnection({
                id: connection?.id,
                name,
                base_url: baseUrl,
                email,
                api_token: apiToken,
                is_default: isDefault ? 1 : 0,
                color: color || undefined,
                is_enabled: isEnabled ? 1 : 0
            });
        }

        onSave();
        onOpenChange(false);
    }

    const handleTestConnection = async () => {
        setTesting(true);
        setTestStatus(null);

        try {
            if (authType === 'oauth' && connection?.id) {
                // Test OAuth connection
                const result = await api.testOAuthConnection(connection.id);
                if (result.success) {
                    setTestStatus({ success: true, message: `Connected as ${result.displayName}` });
                } else {
                    setTestStatus({ success: false, message: result.error || 'Connection failed' });
                }
            } else if (authType === 'api_token') {
                // Test API Token connection
                if (!baseUrl || !email || !apiToken) {
                    setTestStatus({ success: false, message: 'Please fill in Base URL, Email, and API Token.' });
                    return;
                }

                const result = await api.testJiraConnection({ baseUrl, email, apiToken });

                if (result.success) {
                    setTestStatus({ success: true, message: `Connected as ${result.displayName}` });
                } else {
                    setTestStatus({ success: false, message: result.error || 'Connection failed' });
                }
            }
        } catch {
            setTestStatus({ success: false, message: 'Connection failed' });
        } finally {
            setTesting(false);
        }
    }

    const handleAuthorize = async () => {
        if (!clientId || (!clientSecret && !connection?.id)) {
            setTestStatus({ success: false, message: 'Please enter Client ID and Client Secret.' });
            return;
        }

        setAuthorizing(true);
        setTestStatus(null);

        try {
            const result = await api.startOAuthFlow(clientId, clientSecret, connection?.id);

            if (result.success) {
                setOauthAuthorized(true);
                setOauthCloudId(result.cloudId || "");
                setOauthSiteUrl(result.siteUrl || "");
                setOauthTokens({
                    accessTokenEncrypted: result.accessTokenEncrypted,
                    refreshTokenEncrypted: result.refreshTokenEncrypted,
                    clientSecretEncrypted: result.clientSecretEncrypted,
                    expiresIn: result.expiresIn
                });
                setTestStatus({ success: true, message: `Authorized with ${result.siteName || 'Jira'}` });
            } else {
                setTestStatus({ success: false, message: result.error || 'Authorization failed' });
            }
        } catch (e) {
            const err = e as Error;
            setTestStatus({ success: false, message: err.message || 'Authorization failed' });
        } finally {
            setAuthorizing(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{connection ? "Edit Connection" : "Add Jira Connection"}</DialogTitle>
                    <DialogDescription>
                        Configure your Jira instance details.
                    </DialogDescription>
                </DialogHeader>

                <Tabs value={authType} onValueChange={(v) => setAuthType(v as 'api_token' | 'oauth')} className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="api_token" className="flex items-center gap-2">
                            <KeyRound className="h-4 w-4" />
                            API Token
                        </TabsTrigger>
                        <TabsTrigger value="oauth" className="flex items-center gap-2">
                            <ExternalLink className="h-4 w-4" />
                            OAuth
                        </TabsTrigger>
                    </TabsList>

                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="name">Connection Name</Label>
                            <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Work Jira" />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="url">Base URL</Label>
                            <Input
                                id="url"
                                value={oauthSiteUrl || baseUrl}
                                onChange={e => setBaseUrl(e.target.value)}
                                placeholder="https://your-domain.atlassian.net"
                                readOnly={authType === 'oauth' && oauthAuthorized}
                                className={authType === 'oauth' && oauthAuthorized ? 'bg-muted' : ''}
                            />
                            {authType === 'oauth' && (
                                <p className="text-xs text-muted-foreground">
                                    {oauthAuthorized ? 'URL is set from authorized Jira site' : 'URL will be set after OAuth authorization'}
                                </p>
                            )}
                        </div>

                        <TabsContent value="api_token" className="mt-0 space-y-4">
                            <div className="grid gap-2">
                                <Label htmlFor="email">Email</Label>
                                <Input id="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com" />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="token">API Token</Label>
                                <div className="relative">
                                    <Input
                                        id="token"
                                        type={showToken ? "text" : "password"}
                                        value={apiToken}
                                        onChange={e => setApiToken(e.target.value)}
                                        placeholder="Atlassian API Token"
                                        className="pr-10"
                                    />
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                        onClick={() => setShowToken(!showToken)}
                                    >
                                        {showToken ? (
                                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                                        ) : (
                                            <Eye className="h-4 w-4 text-muted-foreground" />
                                        )}
                                    </Button>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    <a href="https://id.atlassian.com/manage-profile/security/api-tokens" target="_blank" rel="noreferrer" className="underline hover:text-primary">
                                        Generate API Token
                                    </a>
                                </p>
                            </div>
                        </TabsContent>

                        <TabsContent value="oauth" className="mt-0 space-y-4">
                            {oauthAuthorized ? (
                                <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                                    <div className="flex-1">
                                        <p className="font-medium text-emerald-700 dark:text-emerald-400">Authorized</p>
                                        <p className="text-sm text-emerald-600 dark:text-emerald-500">
                                            {oauthSiteUrl || 'Connected to Jira'}
                                        </p>
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            setOauthAuthorized(false);
                                            setOauthTokens(null);
                                        }}
                                    >
                                        Re-authorize
                                    </Button>
                                </div>
                            ) : (
                                <>
                                    <div className="grid gap-2">
                                        <Label htmlFor="clientId">Client ID</Label>
                                        <Input
                                            id="clientId"
                                            value={clientId}
                                            onChange={e => setClientId(e.target.value)}
                                            placeholder="OAuth 2.0 Client ID"
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="clientSecret">Client Secret</Label>
                                        <div className="relative">
                                            <Input
                                                id="clientSecret"
                                                type={showClientSecret ? "text" : "password"}
                                                value={clientSecret}
                                                onChange={e => setClientSecret(e.target.value)}
                                                placeholder={connection?.id && authType === 'oauth' ? "•••••••• (Stored in database)" : "OAuth 2.0 Client Secret"}
                                                className="pr-10"
                                            />
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                                onClick={() => setShowClientSecret(!showClientSecret)}
                                            >
                                                {showClientSecret ? (
                                                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                                                ) : (
                                                    <Eye className="h-4 w-4 text-muted-foreground" />
                                                )}
                                            </Button>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            <a href="https://developer.atlassian.com/console/myapps/" target="_blank" rel="noreferrer" className="underline hover:text-primary">
                                                Create OAuth App
                                            </a>
                                            {" "}— Set callback URL to: <code className="text-xs bg-muted px-1 py-0.5 rounded">jira-timetracker-app://oauth/callback</code>
                                        </p>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        {authorizing ? (
                                            <Button
                                                type="button"
                                                variant="destructive"
                                                onClick={async () => {
                                                    await api.cancelOAuthFlow();
                                                    setAuthorizing(false);
                                                    setTestStatus({ success: false, message: 'Authorization cancelled' });
                                                }}
                                                className="w-full"
                                            >
                                                <X className="h-4 w-4 mr-2" /> Cancel Authorization
                                            </Button>
                                        ) : (
                                            <Button
                                                type="button"
                                                onClick={handleAuthorize}
                                                disabled={!clientId || (!clientSecret && !connection?.id)}
                                                className="w-full"
                                            >
                                                <ExternalLink className="h-4 w-4 mr-2" /> Authorize with Jira
                                            </Button>
                                        )}
                                        {authorizing && (
                                            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground animate-pulse">
                                                <Loader2 className="h-3 w-3 animate-spin" />
                                                Waiting for browser...
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </TabsContent>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="color" className="flex items-center gap-2">
                                    <Palette className="h-4 w-4" /> Connection Color
                                </Label>
                                <ColorPicker color={color} onChange={setColor} />
                            </div>
                            <div className="flex flex-col justify-end pb-1 gap-2">
                                <div className="flex items-center space-x-2">
                                    <Checkbox id="enabled" checked={isEnabled} onCheckedChange={(checked) => setIsEnabled(!!checked)} />
                                    <Label htmlFor="enabled">Connection Enabled</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Checkbox id="default" checked={isDefault} onCheckedChange={(checked) => setIsDefault(!!checked)} />
                                    <Label htmlFor="default">Set as default</Label>
                                </div>
                            </div>
                        </div>

                        {testStatus && (
                            <div className={`text-sm p-2 rounded flex items-center gap-2 ${testStatus.success ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400' : 'bg-destructive/10 text-destructive'}`}>
                                {testStatus.success ? (
                                    <span className="font-semibold">Success:</span>
                                ) : (
                                    <span className="font-semibold">Error:</span>
                                )}
                                {testStatus.message}
                            </div>
                        )}

                        {(authType === 'api_token' || (authType === 'oauth' && connection?.id && oauthAuthorized)) && (
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={handleTestConnection}
                                disabled={testing}
                            >
                                {testing ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Plug className="h-3 w-3 mr-2" />}
                                Test Connection
                            </Button>
                        )}
                    </div>
                </Tabs>

                <DialogFooter>
                    <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button
                        type="button"
                        onClick={handleSave}
                        disabled={!name || (authType === 'api_token' && (!baseUrl || !email || !apiToken)) || (authType === 'oauth' && !oauthAuthorized && !oauthTokens)}
                    >
                        Save
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
