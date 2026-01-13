"use client"

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Copy, Check, Clock, FileText } from "lucide-react"
import { useState } from "react"
import { WorkItem } from "@/lib/api"
import { cn } from "@/lib/utils"

interface MonthCellDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    workItem: WorkItem | null;
    dateLabel: string;
    hours: string;
    notes: string;
}

export function MonthCellDialog({
    open,
    onOpenChange,
    workItem,
    dateLabel,
    hours,
    notes
}: MonthCellDialogProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        if (!workItem) return;

        const textToCopy = notes || "";

        await navigator.clipboard.writeText(textToCopy);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (!workItem) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <div className="flex items-center gap-2 text-primary mb-1">
                        <Clock className="w-4 h-4" />
                        <span className="text-sm font-bold uppercase tracking-wider">Daily Details</span>
                    </div>
                    <DialogTitle className="text-xl">
                        {workItem.jira_key && (
                            <span className="text-primary font-mono mr-2">[{workItem.jira_key}]</span>
                        )}
                        {workItem.description}
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground font-medium">
                        {dateLabel}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="flex items-center gap-2 bg-primary/5 p-3 rounded-lg border border-primary/10">
                        <div className="p-2 bg-primary/10 rounded-full">
                            <Clock className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <p className="text-[10px] uppercase font-bold text-muted-foreground/70 tracking-widest leading-none mb-1">Total Hours</p>
                            <p className="text-2xl font-black text-primary leading-none">{hours}h</p>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <FileText className="w-4 h-4" />
                            <p className="text-[10px] uppercase font-bold tracking-widest">Notes from worklogs</p>
                        </div>
                        <div className="bg-muted/50 rounded-lg p-4 border min-h-[100px] max-h-[300px] overflow-auto">
                            {notes ? (
                                <pre className="text-sm font-sans whitespace-pre-wrap break-words leading-relaxed">
                                    {notes}
                                </pre>
                            ) : (
                                <p className="text-sm italic text-muted-foreground text-center py-4">No notes recorded for this day.</p>
                            )}
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        onClick={handleCopy}
                        variant={copied ? "outline" : "default"}
                        className={cn("w-full transition-all gap-2", copied && "border-green-500 text-green-500")}
                    >
                        {copied ? (
                            <>
                                <Check className="w-4 h-4" />
                                Copied to Clipboard
                            </>
                        ) : (
                            <>
                                <Copy className="w-4 h-4" />
                                Copy Notes
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
