import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatSelectModule } from '@angular/material/select';
import { LucideX } from '@lucide/angular';
import type { JiraConnection } from '@/lib/api';
import { DESKTOP_API, errorMessage } from '../core/desktop.service';

@Component({
    imports: [MatDialogModule, MatSelectModule, ReactiveFormsModule, LucideX],
    template: `
        <h2 mat-dialog-title>Change Jira Connection</h2>
        <button type="button" class="dialog-close" mat-dialog-close aria-label="Close" [disabled]="busy()"><svg lucideX class="size-4"></svg></button>
        <mat-dialog-content>
            <p class="legacy-dialog-description">Set a new Jira connection for the {{ data.ids.length }} selected work items.</p>
            <div class="grid gap-4 pt-8 pb-4">
                <div class="field gap-2 font-medium">Jira Connection
                    <mat-select class="legacy-select" panelClass="legacy-select-panel" aria-label="Jira Connection" disableOptionCentering
                        [canSelectNullableOptions]="true" [formControl]="target">
                        <mat-option [value]="null">None (Manual)</mat-option>
                        @for (connection of data.connections; track connection.id) {
                            <mat-option [value]="connection.id">
                                <span class="flex items-center gap-2">
                                    @if (connection.color) { <span class="size-2.5 rounded-full border border-black/10" [style.background]="connection.color"></span> }
                                    {{ connection.name }}
                                    @if (!connection.is_enabled) { <span class="text-[10px] text-muted-foreground">(Disabled)</span> }
                                </span>
                            </mat-option>
                        }
                    </mat-select>
                </div>
                @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
            </div>
        </mat-dialog-content>
        <mat-dialog-actions align="end">
            <button class="legacy-button legacy-outline h-10 px-4" mat-dialog-close [disabled]="busy()">Cancel</button>
            <button class="legacy-button legacy-primary h-10 px-4" (click)="save()" [disabled]="busy()">Update {{ data.ids.length }} Items</button>
        </mat-dialog-actions>
    `,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class BulkConnectionDialog {
    protected readonly data = inject<{ ids: number[]; connections: JiraConnection[] }>(MAT_DIALOG_DATA);
    protected readonly target = new FormControl<number | null>(null);
    protected readonly error = signal('');
    protected readonly busy = signal(false);
    private readonly api = inject(DESKTOP_API);
    private readonly dialog = inject<MatDialogRef<BulkConnectionDialog, boolean>>(MatDialogRef);

    protected async save(): Promise<void> {
        if (this.busy()) return;
        this.busy.set(true);
        try {
            await this.api.bulkUpdateWorkItemsConnection(this.data.ids, this.target.value);
            this.dialog.close(true);
        } catch (error) { this.error.set(errorMessage(error)); }
        finally { this.busy.set(false); }
    }
}
