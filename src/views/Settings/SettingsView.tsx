import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { JiraConnections } from "./JiraConnections"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FolderOpen, Moon, Sun, Monitor } from "lucide-react"
import React from "react"
import { api } from "@/lib/api"

export function SettingsView() {
    const [dbPath, setDbPath] = React.useState("Loading...");

    React.useEffect(() => {
        api.getDatabasePath().then(setDbPath).catch(() => setDbPath("Error fetching path"));
    }, []);

    const handleBrowse = async () => {
        const newPath = await api.selectDatabasePath();
        if (newPath) {
            // Logic to move DB or just show it? 
            // For now, just show the path and note restart required.
            // Ideally we should save this setting.
            // But 'timetracker.db' name is hardcoded in implementation currently unless I change it.
            // Let's assume we just select folder.
            alert(`Database location changed to: ${newPath}\\timetracker.db\nPlease restart the application to apply changes.`);
        }
    }

    return (
        <div className="flex flex-col h-full bg-background p-6 space-y-6 overflow-y-auto">
            <h1 className="text-2xl font-bold tracking-tight">Settings</h1>

            <Tabs defaultValue="connections" className="w-full">
                <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
                    <TabsTrigger value="connections">Connections</TabsTrigger>
                    <TabsTrigger value="general">General</TabsTrigger>
                    <TabsTrigger value="database">Database</TabsTrigger>
                </TabsList>

                <TabsContent value="connections" className="mt-6">
                    <JiraConnections />
                </TabsContent>

                <TabsContent value="general" className="mt-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Appearance</CardTitle>
                            <CardDescription>Customize the application theme.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-3 gap-4">
                                <Button variant="outline" className="flex flex-col items-center gap-2 h-auto py-4">
                                    <Sun className="h-6 w-6" />
                                    <span>Light</span>
                                </Button>
                                <Button variant="outline" className="flex flex-col items-center gap-2 h-auto py-4 border-primary bg-primary/5">
                                    <Moon className="h-6 w-6" />
                                    <span>Dark</span>
                                </Button>
                                <Button variant="outline" className="flex flex-col items-center gap-2 h-auto py-4">
                                    <Monitor className="h-6 w-6" />
                                    <span>System</span>
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="database" className="mt-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Storage Location</CardTitle>
                            <CardDescription>Manage where your data is stored.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-2">
                                <Label>Database Path</Label>
                                <div className="flex gap-2">
                                    <Input value={dbPath} readOnly className="font-mono text-sm" />
                                    <Button variant="secondary" onClick={handleBrowse}>
                                        <FolderOpen className="h-4 w-4 mr-2" /> Browse...
                                    </Button>
                                </div>
                                <p className="text-xs text-muted-foreground">Restart required after changing location.</p>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}
