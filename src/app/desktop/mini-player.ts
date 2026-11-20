import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, signal, untracked } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { LucideCircleStop, LucideMaximize2, LucidePlay, LucideSearch } from '@lucide/angular';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, debounceTime, from, map, of, startWith, switchMap } from 'rxjs';
import type { WorkItem } from '@/lib/api';
import { DESKTOP_API, DESKTOP_IPC, DesktopSettings, errorMessage } from '../core/desktop.service';
import { TrackingService } from '../core/tracking.service';
import { elapsedClock } from '../shared/duration.pipe';
import type { JiraIssue } from '../work-items/jira-issue-picker';

@Component({
    selector: 'app-mini-player',
    imports: [ReactiveFormsModule, LucideCircleStop, LucideMaximize2, LucidePlay, LucideSearch],
    host: { '(keydown.escape)': 'collapse()' },
    templateUrl: './mini-player.html',
    styleUrl: './mini-player.css',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class MiniPlayer {
    private readonly api = inject(DESKTOP_API);
    private readonly ipc = inject(DESKTOP_IPC);
    protected readonly settings = inject(DesktopSettings);
    protected readonly tracking = inject(TrackingService);
    protected readonly query = new FormControl('', { nonNullable: true });
    protected readonly clock = elapsedClock;
    protected readonly expanded = signal(false);
    protected readonly busy = signal(false);
    protected readonly error = signal('');
    protected readonly results = toSignal(this.query.valueChanges.pipe(
        debounceTime(200),
        map(value => value.trim()),
        switchMap(query => {
            this.setExpanded(query.length >= 2 && !this.tracking.workItem());
            if (!this.expanded()) return of(null);
            return from(Promise.all([
                this.api.getWorkItems({ query, limit: 50, showCompleted: true }),
                this.api.searchJiraIssuesAllConnections(query).catch((error: unknown) => ({
                    results: [], errors: [{ connectionName: 'Jira', error: errorMessage(error) }]
                }))
            ])).pipe(
                map(([local, jira]) => {
                    const imported = new Set(local.map(item => item.jira_connection_id + ':' + item.jira_key));
                    return {
                        local: local.filter(item => !item.is_completed || this.settings.values()['hide_completed_items'] === 'false'),
                        jira: jira.results.filter(issue => !imported.has(issue.connectionId + ':' + issue.key)),
                        errors: jira.errors.map(item => item.connectionName + ' ' + item.error)
                    };
                }),
                startWith(null),
                catchError(error => {
                    this.error.set(errorMessage(error));
                    return of(null);
                })
            );
        })
    ), { initialValue: null });

    constructor() {
        void this.settings.initialize(true);
        effect(() => {
            if (this.tracking.workItem()) untracked(() => this.collapse());
        });
        if (this.ipc) {
            const onBlur = () => this.collapse();
            window.addEventListener('blur', onBlur);
            inject(DestroyRef).onDestroy(() => window.removeEventListener('blur', onBlur));
        }
    }

    private setExpanded(expanded: boolean): void {
        if (this.expanded() === expanded) return;
        this.expanded.set(expanded);
        this.ipc.send('mini-player:set-search-active', expanded);
    }

    protected collapse(): void {
        this.setExpanded(false);
        this.query.reset();
    }

    protected expand(): void {
        this.collapse();
        this.ipc.send('mini-player:expand');
    }

    protected async start(item: WorkItem): Promise<void> {
        await this.run(async () => { await this.tracking.start(item); this.collapse(); });
    }

    protected async importIssue(issue: JiraIssue): Promise<void> {
        await this.run(async () => {
            const item = await this.api.saveWorkItem({ description: issue.summary || issue.key, jira_key: issue.key, jira_connection_id: issue.connectionId });
            await this.tracking.start(item);
            this.collapse();
        });
    }

    protected async stop(): Promise<void> {
        await this.run(async () => { await this.tracking.stop(); this.expand(); });
    }

    private async run(action: () => Promise<void>): Promise<void> {
        if (this.busy()) return;
        this.busy.set(true);
        this.error.set('');
        try { await action(); }
        catch (error) { this.error.set(errorMessage(error)); }
        finally { this.busy.set(false); }
    }
}
