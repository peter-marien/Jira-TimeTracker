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
import { Eye, EyeOff, Loader2, Plug } from "lucide-react"

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

    // New state
    const [showToken, setShowToken] = useState(false);
    const [testing, setTesting] = useState(false);
    const [testStatus, setTestStatus] = useState<{ success: boolean, message: string } | null>(null);

    useEffect(() => {
        if (open) {
            if (connection) {
                setName(connection.name);
                setBaseUrl(connection.base_url);
                setEmail(connection.email);
                setApiToken(connection.api_token);
                setIsDefault(!!connection.is_default);
            } else {
                setName("");
                setBaseUrl("");
                setEmail("");
                setApiToken("");
                setIsDefault(false);
            }
            setTestStatus(null);
            setShowToken(false);
        }
    }, [connection, open]);

    const handleSave = async () => {
        if (!name || !baseUrl || !email || !apiToken) return;

        await api.saveJiraConnection({
            id: connection?.id,
            name,
            base_url: baseUrl,
            email,
            api_token: apiToken,
            is_default: isDefault ? 1 : 0
        });

        onSave();
        onOpenChange(false);
    }

    const handleTestConnection = async () => {
        if (!baseUrl || !email || !apiToken) {
            setTestStatus({ success: false, message: 'Please fill in Base URL, Email, and API Token.' });
            return;
        }

        setTesting(true);
        setTestStatus(null);

        try {
            const result = await api.testJiraConnection({ baseUrl, email, apiToken });

            if (result.success) {
                setTestStatus({ success: true, message: `Connected as ${result.displayName}` });
            } else {
                setTestStatus({ success: false, message: result.error || 'Connection failed' });
            }
        } catch (e) {
            setTestStatus({ success: false, message: 'Connection failed' });
        } finally {
            setTesting(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{connection ? "Edit Connection" : "Add Jira Connection"}</DialogTitle>
                    <DialogDescription>
                        Configure your Jira instance details.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="name">Connection Name</Label>
                        <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Work Jira" />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="url">Base URL</Label>
                        <Input id="url" value={baseUrl} onChange={e => setBaseUrl(e.target.value)} placeholder="https://your-domain.atlassian.net" />
                    </div>
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

                    {testStatus && (
                        <div className={`text-sm p-2 rounded flex items-center gap-2 ${testStatus.success ? 'bg-emerald-50 text-emerald-700' : 'bg-destructive/10 text-destructive'}`}>
                            {testStatus.success ? (
                                <span className="font-semibold">Success:</span>
                            ) : (
                                <span className="font-semibold">Error:</span>
                            )}
                            {testStatus.message}
                        </div>
                    )}

                    <div className="flex items-center space-x-2 pt-2 justify-between">
                        <div className="flex items-center space-x-2">
                            <Checkbox id="default" checked={isDefault} onCheckedChange={(checked) => setIsDefault(!!checked)} />
                            <Label htmlFor="default">Set as default</Label>
                        </div>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleTestConnection}
                            disabled={testing}
                        >
                            {testing ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Plug className="h-3 w-3 mr-2" />}
                            Test
                        </Button>
                    </div>
                </div>
                <DialogFooter>
                    <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button type="button" onClick={handleSave}>Save</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
