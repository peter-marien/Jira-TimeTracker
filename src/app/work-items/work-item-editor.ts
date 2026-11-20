import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { LucidePlus, LucideX } from '@lucide/angular';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatSelectModule } from '@angular/material/select';
import type { JiraConnection, WorkItem } from '@/lib/api';
import { DESKTOP_API, errorMessage } from '../core/desktop.service';
import { JiraIssuePicker, type JiraIssue } from './jira-issue-picker';

export interface WorkItemEditorData {
    item?: WorkItem;
    import?: boolean;
}

@Component({
    imports: [ReactiveFormsModule, MatDialogModule, MatSelectModule, JiraIssuePicker, LucidePlus, LucideX],
    template: `
        <h2 mat-dialog-title>{{ data.import ? 'Import from Jira' : data.item ? 'Edit Work Item' : 'Create Manual Work Item' }}</h2>
        <button type="button" class="dialog-close" mat-dialog-close aria-label="Close" [disabled]="busy()"><svg lucideX class="size-4"></svg></button>
        <mat-dialog-content>
            <p class="legacy-dialog-description mb-4">{{ data.import ? 'Search for an issue to import as a work item.' : data.item ? 'Update work item details.' : 'Create a local work item. You can optionally link it to Jira.' }}</p>
            <form id="work-item-editor" class="grid gap-4 py-4" [formGroup]="form" (ngSubmit)="save()">
                @if (data.import) {
                    <app-jira-issue-picker [preview]="true" (selected)="applyIssue($event)" (cleared)="hasIssue.set(false)" />
                } @else {
                <label class="field gap-2 font-medium">Description
                    <input class="h-10" formControlName="description" [placeholder]="data.item ? 'Description' : 'e.g. Internal Meeting'" required>
                </label>
                <div class="field gap-2 font-medium">{{ data.item ? 'Jira Connection' : 'Jira Connection (Optional)' }}
                    <mat-select class="legacy-select" panelClass="legacy-select-panel" aria-label="Jira Connection" disableOptionCentering [canSelectNullableOptions]="true" formControlName="connection">
                        <mat-option [value]="null">{{ data.item ? 'None' : 'None (Manual)' }}</mat-option>
                        @for (connection of connections(); track connection.id) {
                            <mat-option [value]="connection.id">
                                <span class="flex items-center gap-2">
                                    @if (connection.color) { <span class="size-2.5 rounded-full shrink-0 border border-black/10" [style.background]="connection.color"></span> }
                                    {{ connection.name }}
                                    @if (!connection.is_enabled) { <span class="text-[10px] text-muted-foreground">(Disabled)</span> }
                                </span>
                            </mat-option>
                        }
                    </mat-select>
                </div>
                <label class="field gap-2 font-medium">Jira Key (Optional)
                    <input class="h-10" formControlName="key" [placeholder]="data.item ? 'PROJ-123' : 'e.g. PROJ-123'">
                </label>
                }
                @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
            </form>
        </mat-dialog-content>
        <mat-dialog-actions align="end">
            @if (data.import) { <button class="legacy-button legacy-outline h-10 px-4" type="button" mat-dialog-close [disabled]="busy()">Cancel</button> }
            <button class="legacy-button legacy-primary h-10 px-4" type="submit" form="work-item-editor" [disabled]="busy() || (data.import && !hasIssue())">
                @if (data.import) { <svg lucidePlus class="size-4 mr-2"></svg>{{ busy() ? 'Importing...' : 'Import' }} }
                @else { {{ data.item ? 'Save Changes' : 'Create' }} }
            </button>
        </mat-dialog-actions>
    `,
    styles: ['mat-dialog-content { padding-top:6px !important; }'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class WorkItemEditor {
    private readonly api = inject(DESKTOP_API);
    private readonly dialog = inject<MatDialogRef<WorkItemEditor, WorkItem>>(MatDialogRef);
    protected readonly data = inject<WorkItemEditorData>(MAT_DIALOG_DATA);
    protected readonly error = signal('');
    protected readonly busy = signal(false);
    protected readonly hasIssue = signal(false);
    protected readonly connections = signal<JiraConnection[]>([]);
    protected readonly form = inject(NonNullableFormBuilder).group({
        description: [this.data.item?.description ?? '', Validators.required],
        key: this.data.item?.jira_key ?? '',
        connection: [this.data.item?.jira_connection_id ?? null as number | null]
    });

    constructor() {
        if (!this.data.item && !this.data.import) {
            this.form.controls.key.disable();
            this.form.controls.connection.valueChanges.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe(connection => {
                if (connection === null) this.form.controls.key.disable();
                else this.form.controls.key.enable();
            });
        }
        void this.api.getJiraConnections().then(connections => this.connections.set(connections))
            .catch(error => this.error.set(errorMessage(error)));
    }

    protected applyIssue(issue: JiraIssue): void {
        this.form.patchValue({ description: issue.summary, key: issue.key, connection: issue.connectionId });
        this.hasIssue.set(true);
    }

    protected async save(): Promise<void> {
        if (this.busy() || (this.data.import && !this.hasIssue())) return;
        const value = this.form.getRawValue();
        if (!value.description.trim()) {
            this.error.set('Enter a description.');
            return;
        }
        this.busy.set(true);
        this.error.set('');
        try {
            const item = await this.api.saveWorkItem({
                id: this.data.item?.id,
                description: value.description.trim(),
                jira_key: value.key.trim().toUpperCase() || null,
                jira_connection_id: value.connection
            });
            this.dialog.close(item);
        } catch (error) {
            this.error.set(errorMessage(error));
        } finally {
            this.busy.set(false);
        }
    }
}
