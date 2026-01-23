import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { useState } from "react"

export type ConflictResolutionBehavior = 'split_preserve_duration' | 'split_preserve_end'

interface TimelineConflictDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onResolve: (behavior: ConflictResolutionBehavior) => void
}

export function TimelineConflictDialog({ open, onOpenChange, onResolve }: TimelineConflictDialogProps) {
    const [behavior, setBehavior] = useState<ConflictResolutionBehavior>('split_preserve_duration')

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent className="sm:max-w-[500px]">
                <AlertDialogHeader>
                    <AlertDialogTitle>Timeline Conflict</AlertDialogTitle>
                    <AlertDialogDescription>
                        The moved segment overlaps with an existing time slice. How would you like to resolve this?
                    </AlertDialogDescription>
                </AlertDialogHeader>

                <RadioGroup
                    value={behavior}
                    onValueChange={(v) => setBehavior(v as ConflictResolutionBehavior)}
                    className="py-4"
                >
                    <div className="flex items-start space-x-3 space-y-0 rounded-md border p-4 shadow-sm hover:bg-accent/50 transition-colors cursor-pointer">
                        <RadioGroupItem value="split_preserve_duration" id="duration" className="mt-1" />
                        <div className="grid gap-1.5 leading-none">
                            <Label htmlFor="duration" className="text-sm font-semibold cursor-pointer">
                                Split & Preserve Duration
                            </Label>
                            <p className="text-xs text-muted-foreground">
                                Split the existing slice and push the second half forward. Both parts will keep their original total time.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-start space-x-3 space-y-0 rounded-md border p-4 shadow-sm hover:bg-accent/50 transition-colors cursor-pointer">
                        <RadioGroupItem value="split_preserve_end" id="end" className="mt-1" />
                        <div className="grid gap-1.5 leading-none">
                            <Label htmlFor="end" className="text-sm font-semibold cursor-pointer">
                                Split & Preserve End Time
                            </Label>
                            <p className="text-xs text-muted-foreground">
                                Split the existing slice and overwrite the overlapping part. The final end time of the slice remains unchanged.
                            </p>
                        </div>
                    </div>
                </RadioGroup>

                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onResolve(behavior)}>
                        Apply Changes
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
