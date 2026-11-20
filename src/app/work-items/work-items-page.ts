import { ChangeDetectionStrategy, Component, inject, linkedSignal, resource, signal } from '@angular/core';
import { CdkMenuModule } from '@angular/cdk/menu';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { LucideArrowRightLeft, LucideCircleCheck, LucideCirclePlay, LucideCircleX, LucideClock, LucideDownload, LucideEllipsis, LucideExternalLink, LucideHistory, LucidePencil, LucidePlus, LucideSearch, LucideTrash2 } from '@lucide/angular';
import { MatDialog } from '@angular/material/dialog';
import type { PageEvent } from '@angular/material/paginator';
import { debounceTime, distinctUntilChanged, firstValueFrom } from 'rxjs';
import type { WorkItem } from '@/lib/api';
import { DESKTOP_API, Feedback, errorMessage } from '../core/desktop.service';
import { TrackingService } from '../core/tracking.service';
import { actionMenuPositions } from '../shared/action-menu';
import { confirm } from '../shared/confirm-dialog';
import { DurationPipe } from '../shared/duration.pipe';
import { PageControls } from '../shared/page-controls';
import { isRowControl, selectedRows } from '../shared/row-selection';
import { BulkConnectionDialog } from './bulk-connection-dialog';
import { startTrackingFromWorkItemOverview } from './work-item-actions';
import { WorkItemEditor, type WorkItemEditorData } from './work-item-editor';
import { WorkItemHistory } from './work-item-history';

@Component({
    imports: [MatSlideToggle, CdkMenuModule, ReactiveFormsModule, PageControls, DurationPipe,
        LucideArrowRightLeft, LucideCircleCheck, LucideCirclePlay, LucideCircleX, LucideClock, LucideDownload,
        LucideEllipsis, LucideExternalLink, LucideHistory, LucidePencil, LucidePlus, LucideSearch, LucideTrash2],
    templateUrl: './work-items-page.html',
    styles: [`
        :host { display:block; height:100%; }
        .work-items-page { display:flex; flex-direction:column; height:100%; }
        .work-item-table { flex:1; min-height:0; }
        .completed:not(.selected) { opacity:.6; background:hsl(var(--muted) / .2); }
        .selected { background:hsl(var(--primary) / .1); }
        tbody tr:hover { background:hsl(var(--accent) / .5); }
        th { height:48px; padding:0 16px; font-weight:500; }
        td { padding:16px; }
        th, td { font-size:14px; }
        tr:last-child td { border-bottom:0; }
    `],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class WorkItemsPage {
    protected readonly menuPositions = actionMenuPositions;
    private readonly api = inject(DESKTOP_API);
    private readonly dialog = inject(MatDialog);
    private readonly feedback = inject(Feedback);
    protected readonly tracking = inject(TrackingService);
    protected readonly message = errorMessage;
    protected readonly query = new FormControl('', { nonNullable: true });
    private readonly search = toSignal(this.query.valueChanges.pipe(debounceTime(200), distinctUntilChanged()), { initialValue: '' });
    protected readonly completed = signal(false);
    protected readonly page = linkedSignal(() => { this.search(); this.completed(); return 0; });
    protected readonly size = signal(50);
    protected readonly selected = linkedSignal(() => { this.search(); this.completed(); return [] as number[]; });
    private anchor: number | null = null;
    protected readonly results = resource({
        params: () => ({ query: this.search().trim(), limit: this.size(), offset: this.size() * this.page(), showCompleted: this.completed(), revision: this.tracking.revision() }),
        loader: async ({ params: { query, limit, offset, showCompleted } }) => {
            const [items, total] = await Promise.all([
                this.api.getWorkItems({ query, limit, offset, showCompleted }), this.api.getWorkItemsCount({ query, showCompleted })
            ]);
            return { items, total };
        }
    });
    protected changePage(event: PageEvent): void {
        this.size.set(event.pageSize);
        this.page.set(event.pageIndex);
    }

    protected selectRow(event: MouseEvent, id: number): void {
        if (isRowControl(event) || !this.results.hasValue()) return;
        this.selected.update(ids => selectedRows(this.results.value()!.items.map(item => item.id), ids, this.anchor, id, event));
        this.anchor = id;
    }

    protected open(event: MouseEvent, item: WorkItem): void {
        if (!isRowControl(event)) void this.edit({ item });
    }

    protected async edit(data: WorkItemEditorData): Promise<void> {
        if (await firstValueFrom(this.dialog.open(WorkItemEditor, { data, width: data.import ? '500px' : '425px' }).afterClosed())) this.results.reload();
    }

    protected history(item: WorkItem): void {
        const window = this.dialog.open(WorkItemHistory, { data: item, width: '896px', height: '85vh', maxWidth: 'calc(100vw - 32px)' });
        window.afterClosed().subscribe(() => this.results.reload());
    }

    protected async start(item: WorkItem): Promise<void> {
        await startTrackingFromWorkItemOverview(item, {
            startTracking: workItem => this.tracking.start(workItem),
            refreshWorkItems: () => { this.results.reload(); },
            logError: (_message, error) => this.feedback.error(error)
        });
    }

    protected async complete(ids: number[], completed: boolean): Promise<void> {
        await this.mutate(() => this.api.updateWorkItemCompletion(ids, completed));
    }

    protected async changeConnection(ids = this.selected()): Promise<void> {
        try {
            const connections = await this.api.getJiraConnections();
            if (await firstValueFrom(this.dialog.open(BulkConnectionDialog, { data: { ids, connections }, width: '425px' }).afterClosed())) {
                this.selected.set([]);
                this.results.reload();
            }
        } catch (error) { this.feedback.error(error); }
    }

    protected async remove(item: WorkItem): Promise<void> {
        if (!await confirm(this.dialog, { title: 'Delete Work Item?', message: `Are you sure you want to delete "${item.description}"?`, action: 'Delete', destructive: true })) return;
        await this.mutate(() => this.api.deleteWorkItem(item.id));
    }

    protected async openJira(item: WorkItem): Promise<void> {
        try {
            const connection = (await this.api.getJiraConnections()).find(conn => conn.id === item.jira_connection_id);
            if (connection && item.jira_key) await this.api.openExternal(new URL('browse/' + encodeURIComponent(item.jira_key), connection.base_url.replace(/\/$/, '') + '/').href);
        } catch (error) { this.feedback.error(error); }
    }

    private async mutate(action: () => Promise<unknown>): Promise<void> {
        try { await action(); this.selected.set([]); this.results.reload(); }
        catch (error) { this.feedback.error(error); }
    }
}
