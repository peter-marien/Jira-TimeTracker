import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { Clipboard } from '@angular/cdk/clipboard';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { LucideCheck, LucideClock, LucideCopy, LucideFileText, LucideX } from '@lucide/angular';
import { format } from 'date-fns';
import { DESKTOP_API, Feedback } from '../core/desktop.service';
import { sliceSeconds } from '../shared/duration.pipe';
import type { MonthCell } from './month-hours-matrix';

@Component({
    imports: [DecimalPipe, MatDialogModule, LucideCheck, LucideClock, LucideCopy, LucideFileText, LucideX],
    template: `
        <h2 mat-dialog-title>
            <span class="flex items-center gap-2 text-primary mb-1 text-sm font-bold uppercase tracking-wider"><svg lucideClock class="size-4"></svg>Daily Details</span>
            <span class="text-xl">@if (data.row.key) { <span class="text-primary font-mono mr-2">[{{ data.row.key }}]</span> }{{ data.row.description }}</span>
        </h2>
        <button class="dialog-close" mat-dialog-close type="button" aria-label="Close"><svg lucideX class="size-4"></svg></button>
        <mat-dialog-content>
            <p class="text-muted-foreground font-medium">{{ dayLabel }}</p>
            <div class="space-y-4 pt-4">
                <div class="flex items-center gap-2 bg-primary/5 p-3 border border-primary/10">
                    <div class="p-2 bg-primary/10 rounded-full"><svg lucideClock class="size-5 text-primary"></svg></div>
                    <div>
                        <p class="text-[10px] uppercase font-bold text-muted-foreground/70 tracking-widest leading-none mb-1">Total Hours</p>
                        <p class="text-2xl font-black text-primary leading-none">{{ hours | number:'1.0-2' }}h</p>
                    </div>
                </div>
                <div class="space-y-2">
                    <div class="flex items-center gap-2 text-muted-foreground"><svg lucideFileText class="size-4"></svg><p class="text-[10px] uppercase font-bold tracking-widest">Notes from worklogs</p></div>
                    <div class="bg-muted/50 border p-4 min-h-[100px] max-h-[300px] overflow-auto">
                        @if (notes) { <pre class="text-sm font-sans whitespace-pre-wrap wrap-break-word leading-relaxed">{{ notes }}</pre> }
                        @else { <p class="text-sm italic text-muted-foreground text-center py-4">No notes recorded for this day.</p> }
                    </div>
                </div>
            </div>
        </mat-dialog-content>
        <mat-dialog-actions>
            <button type="button" class="legacy-button h-10 w-full" [class.legacy-primary]="!copied()" [class.legacy-outline]="copied()" (click)="copy()">
                @if (copied()) { <svg lucideCheck class="size-4"></svg>Copied to Clipboard }
                @else { <svg lucideCopy class="size-4"></svg>Copy Notes &amp; open in Jira }
            </button>
        </mat-dialog-actions>
    `,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class MonthCellDialog {
    protected readonly data = inject<MonthCell>(MAT_DIALOG_DATA);
    protected readonly dayLabel = format(this.data.date, 'EEEE, MMMM do, yyyy');
    protected readonly hours = this.data.slices.reduce((sum, slice) => sum + sliceSeconds(slice), 0) / 3600;
    protected readonly notes = [...new Set(this.data.slices.map(slice => slice.notes?.trim()).filter(Boolean))].join('\n');
    protected readonly copied = signal(false);
    private readonly clipboard = inject(Clipboard);
    private readonly api = inject(DESKTOP_API);
    private readonly feedback = inject(Feedback);
    private timer?: ReturnType<typeof setTimeout>;

    constructor() {
        inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
    }

    protected async copy(): Promise<void> {
        if (!this.clipboard.copy(this.notes)) return;
        this.copied.set(true);
        clearTimeout(this.timer);
        this.timer = setTimeout(() => this.copied.set(false), 2000);
        const { key, connectionId } = this.data.row;
        if (!key || !connectionId) return;
        try {
            const connection = (await this.api.getJiraConnections()).find(item => item.id === connectionId);
            if (connection) await this.api.openExternal(new URL('browse/' + encodeURIComponent(key), connection.base_url.replace(/\/$/, '') + '/').href);
        } catch (error) { this.feedback.error(error); }
    }
}
