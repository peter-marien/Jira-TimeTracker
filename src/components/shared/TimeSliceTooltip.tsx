import { TooltipContent } from "@/components/ui/tooltip"

interface TooltipItem {
    id: number | string
    startTime?: string | null
    endTime?: string | null
    text?: string | null
}

interface TimeSliceTooltipContentProps {
    dateLabel: string
    jiraKey?: string | null
    description?: string | null
    items: TooltipItem[]
}

export function TimeSliceTooltipContent({ dateLabel, jiraKey, description, items }: TimeSliceTooltipContentProps) {
    if (items.length === 0) return null;

    return (
        <TooltipContent side="top" className="max-w-[400px] p-0 overflow-hidden shadow-xl border-border">
            <div className="flex flex-col text-left">
                {/* Header */}
                <div className="bg-muted px-4 py-2 border-b border-border">
                    <div className="flex flex-col">
                        <span className="font-bold text-xs">{dateLabel}</span>
                        {(jiraKey || description) && (
                            <div className="flex gap-2 items-baseline mt-0.5">
                                {jiraKey && <span className="text-[10px] font-mono font-bold text-primary">{jiraKey}</span>}
                                {description && <span className="text-[10px] text-muted-foreground truncate">{description}</span>}
                            </div>
                        )}
                    </div>
                </div>

                {/* Body */}
                <div className="p-4 bg-popover space-y-1">
                    {items.map(item => {
                        const start = item.startTime ? new Date(item.startTime) : null;
                        const end = item.endTime ? new Date(item.endTime) : null;

                        const formatTime = (date: Date) => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

                        const timeStr = start
                            ? `${formatTime(start)} - ${end ? formatTime(end) : 'Now'}`
                            : '';

                        return (
                            <div key={item.id} className="text-[10px] leading-tight flex gap-3">
                                {timeStr && (
                                    <span className="font-mono text-muted-foreground shrink-0 tabular-nums opacity-80">
                                        {timeStr}:
                                    </span>
                                )}
                                <span className="break-words">
                                    {item.text || <span className="italic opacity-50">No notes</span>}
                                </span>
                            </div>
                        )
                    })}
                </div>
            </div>
        </TooltipContent>
    )
}
