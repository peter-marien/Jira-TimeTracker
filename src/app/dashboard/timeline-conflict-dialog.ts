import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { MatDialogModule } from '@angular/material/dialog';

export type TimelineResolution = 'preserve-duration' | 'preserve-end';

@Component({
    imports: [MatDialogModule],
    template: `
        <h2 mat-dialog-title>Timeline Conflict</h2>
        <mat-dialog-content>
            <p class="legacy-dialog-description">The moved segment overlaps with an existing time slice. How would you like to resolve this?</p>
            <fieldset class="grid gap-2 py-4 mt-4" aria-label="Conflict resolution">
                @for (choice of choices; track choice.value) {
                    <label class="flex items-start gap-3 border p-4 shadow-xs hover:bg-accent/50 cursor-pointer">
                        <input type="radio" name="timeline-resolution" class="legacy-radio mt-1" [checked]="selected() === choice.value"
                            (change)="selected.set(choice.value)">
                        <span class="grid gap-1.5"><strong class="font-semibold leading-none">{{ choice.title }}</strong><span class="text-xs text-muted-foreground">{{ choice.description }}</span></span>
                    </label>
                }
            </fieldset>
        </mat-dialog-content>
        <mat-dialog-actions align="end">
            <button class="legacy-button legacy-outline h-10 px-4" mat-dialog-close cdkFocusInitial>Cancel</button>
            <button class="legacy-button legacy-primary h-10 px-4" [mat-dialog-close]="selected()">Apply Changes</button>
        </mat-dialog-actions>
    `,
    styles: [`mat-dialog-content { padding-top:8px !important; }
        .legacy-radio { appearance:none; display:grid; place-content:center; width:16px; height:16px; border:1px solid hsl(var(--primary)); border-radius:50%; flex-shrink:0; }
        .legacy-radio:checked::after { content:''; width:10px; height:10px; border-radius:50%; background:hsl(var(--primary)); }
    `],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class TimelineConflictDialog {
    protected readonly selected = signal<TimelineResolution>('preserve-duration');
    protected readonly choices = [
        { value: 'preserve-duration', title: 'Split & Preserve Duration', description: 'Split the existing slice and push the second half forward. Both parts will keep their original total time.' },
        { value: 'preserve-end', title: 'Split & Preserve End Time', description: 'Split the existing slice and overwrite the overlapping part. The final end time of the slice remains unchanged.' }
    ] as const;
}
