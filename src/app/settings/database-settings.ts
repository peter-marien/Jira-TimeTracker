import { ChangeDetectionStrategy, Component, inject, resource, signal } from '@angular/core';
import { LucideFilePlus2, LucideFolderOpen, LucideTrash2, LucideUpload } from '@lucide/angular';
import { MatCheckbox } from '@angular/material/checkbox';
import { MatDialog } from '@angular/material/dialog';
import { DESKTOP_API, Feedback, errorMessage } from '../core/desktop.service';
import { confirm } from '../shared/confirm-dialog';
import { ImportWorklogsDialog } from './import-worklogs-dialog';

@Component({
    selector: 'app-database-settings',
    imports: [MatCheckbox, LucideFilePlus2, LucideFolderOpen, LucideTrash2, LucideUpload],
    template: `
        <div class="grid gap-6">
            <section class="panel grid gap-4">
                <header class="space-y-1.5 mb-2"><h2 class="legacy-card-title">Storage Location</h2><p class="text-sm text-muted-foreground">Manage where your data is stored.</p></header>
                @if (path.error(); as error) { <p class="error" role="alert">{{ message(error) }}</p> }
                @else {
                    <div class="field gap-2 text-sm font-medium">
                        <span>Current Database File</span>
                        <output class="path border px-3 py-2 h-10">{{ pendingPath() || path.value() || 'Loading database path…' }}</output>
                    </div>
                }
                <div class="flex gap-2">
                    <button class="legacy-button bg-secondary text-secondary-foreground h-10 px-4" [disabled]="busy()" (click)="changePath(false)"><svg lucideFolderOpen class="size-4 mr-2"></svg>Open Existing...</button>
                    <button class="legacy-button legacy-outline h-10 px-4" [disabled]="busy()" (click)="changePath(true)"><svg lucideFilePlus2 class="size-4 mr-2"></svg>Create New...</button>
                </div>
                <p class="text-xs text-muted-foreground">Select an existing database file or create a new one. Restart required after changing.</p>
            </section>
            <section class="panel grid gap-6">
                <header class="space-y-1.5">
                    <h2 class="legacy-card-title flex items-center gap-2"><svg lucideUpload class="size-5"></svg>Import Data</h2>
                    <p class="text-sm text-muted-foreground">Import time slices from CSV or Jira worklogs into your local database.</p>
                </header>
                <div class="grid gap-4 md:grid-cols-2">
                    <div class="grid gap-2 border p-4">
                        <p class="text-sm font-medium">CSV Import</p>
                        <p class="text-sm text-muted-foreground">Expected CSV format: Start of timeslice, End of timeslice, timeslice notes, WorkItem, Jira key<br><span class="text-xs">Times should be in UTC format (e.g., 2025-12-01 07:30:00)</span></p>
                        <button class="legacy-button legacy-primary w-fit h-10 px-4" [disabled]="busy()" (click)="importCsv()"><svg lucideUpload class="size-4 mr-2"></svg>Select CSV File...</button>
                    </div>
                    <div class="grid gap-2 border p-4">
                        <p class="text-sm font-medium">Jira Worklog Import</p>
                        <p class="text-sm text-muted-foreground">Import your own Jira worklogs for a date range and selected Jira connections.</p>
                        <button class="legacy-button legacy-outline w-fit h-10 px-4" [disabled]="busy()" (click)="importJira()"><svg lucideUpload class="size-4 mr-2"></svg>Import Jira Worklogs...</button>
                    </div>
                </div>
                @if (importResult()) { <p role="status">{{ importResult() }}</p> }
            </section>
            <section class="panel grid gap-6 border-destructive/20">
                <header class="space-y-1.5">
                    <h2 class="legacy-card-title text-destructive flex items-center gap-2"><svg lucideTrash2 class="size-5"></svg>Database Cleanup</h2>
                    <p class="text-sm text-muted-foreground">Permanently remove data from your local database.</p>
                </header>
                <div class="grid gap-4">
                    <mat-checkbox [checked]="clearSlices() || clearItems()" [disabled]="clearItems()" (change)="clearSlices.set($event.checked)">
                        <span class="font-medium">Clear Time Slices</span><span class="block text-xs text-muted-foreground">Removes all tracked time periods. Work items will remain.</span>
                    </mat-checkbox>
                    <mat-checkbox [checked]="clearItems()" (change)="clearItems.set($event.checked)">
                        <span class="font-medium">Clear Work Items</span><span class="block text-xs text-muted-foreground">Removes all work items and their associated time slices.</span>
                    </mat-checkbox>
                </div>
                <div><button class="legacy-button bg-destructive text-destructive-foreground h-10 px-4" [disabled]="busy() || (!clearSlices() && !clearItems())" (click)="clear()">Clear Selected Data</button></div>
            </section>
        </div>
    `,
    styles: ['.path { overflow-wrap:anywhere; font-family:ui-monospace, monospace; }'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class DatabaseSettings {
    private readonly api = inject(DESKTOP_API);
    private readonly dialog = inject(MatDialog);
    private readonly feedback = inject(Feedback);
    protected readonly message = errorMessage;
    protected readonly path = resource({ loader: () => this.api.getDatabasePath() });
    protected readonly pendingPath = signal('');
    protected readonly busy = signal(false);
    protected readonly clearSlices = signal(false);
    protected readonly clearItems = signal(false);
    protected readonly importResult = signal('');

    protected async changePath(create: boolean): Promise<void> {
        await this.run(async () => {
            const result = create ? await this.api.createDatabaseFile() : await this.api.selectDatabaseFile();
            if (result.canceled) return;
            if (!result.success || !result.filePath) throw new Error('error' in result ? String(result.error) : 'Could not set the database location.');
            await this.api.saveDatabasePath(result.filePath);
            this.pendingPath.set(result.filePath);
            this.feedback.show('Database location saved. Restart the app to apply the change.');
        });
    }

    protected async importCsv(): Promise<void> {
        await this.run(async () => {
            const file = await this.api.selectCsvFile();
            if (!file) return;
            const result = await this.api.importCsv(await this.api.readFile(file));
            this.importResult.set(`${result.importedSlices} time slices imported, ${result.createdWorkItems} work items and ${result.createdTags} tags created, ${result.reusedWorkItems} work items reused, ${result.skippedLines} lines skipped.`);
        });
    }

    protected importJira(): void {
        this.dialog.open(ImportWorklogsDialog, { width: '760px', maxWidth: 'calc(100vw - 32px)', maxHeight: '85vh' });
    }

    protected async clear(): Promise<void> {
        const clearWorkItems = this.clearItems();
        const clearTimeSlices = this.clearSlices() || clearWorkItems;
        if (!clearTimeSlices || !await confirm(this.dialog, {
            title: 'Are you absolutely sure?', message: 'This action cannot be undone. This will permanently delete the selected data from your local database.', action: 'Continue', destructive: true
        })) return;
        await this.run(async () => {
            await this.api.clearDatabase({ clearWorkItems, clearTimeSlices });
            this.clearItems.set(false);
            this.clearSlices.set(false);
            this.feedback.show('Selected local data cleared.');
        });
    }

    private async run(action: () => Promise<void>): Promise<void> {
        if (this.busy()) return;
        this.busy.set(true);
        try { await action(); } catch (error) { this.feedback.error(error); } finally { this.busy.set(false); }
    }
}
