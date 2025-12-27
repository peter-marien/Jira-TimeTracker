import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface JiraBadgeProps {
    connectionName?: string;
    jiraKey?: string;
    className?: string;
}

export function JiraBadge({ connectionName, jiraKey, className }: JiraBadgeProps) {
    if (!connectionName && !jiraKey) return null;

    return (
        <div className={cn("flex items-center gap-2", className)}>
            {connectionName && (
                <Badge variant="outline" className="bg-jira/10 text-jira border-jira/20 hover:bg-jira/20 transition-colors">
                    {connectionName}
                </Badge>
            )}
            {jiraKey && (
                <span className="font-mono-data text-xs text-muted-foreground font-medium">
                    {jiraKey}
                </span>
            )}
        </div>
    )
}
