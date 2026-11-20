import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { LucideLoaderCircle, LucideX } from '@lucide/angular';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, debounceTime, distinctUntilChanged, from, map, of, startWith, switchMap } from 'rxjs';
import { DESKTOP_API, errorMessage } from '../core/desktop.service';

type SearchResult = Awaited<ReturnType<typeof import('@/lib/api').api.searchJiraIssuesAllConnections>>;
export type JiraIssue = SearchResult['results'][number];

@Component({
    selector: 'app-jira-issue-picker',
    imports: [ReactiveFormsModule, LucideLoaderCircle, LucideX],
    template: `
        <div class="relative">
            <input class="control h-10 w-full pr-8" type="search" aria-label="Search Jira" [formControl]="query"
                (input)="clear()" placeholder="Search by key or summary (e.g. PROJ-123)">
            @if (state() === 'loading') {
                <svg lucideLoaderCircle class="absolute right-2.5 top-1/2 -translate-y-1/2 size-4 animate-spin text-muted-foreground" role="status" aria-label="Searching Jira"></svg>
            }
        </div>
        @if (preview() ? issue() : null; as chosen) {
            <div class="p-3 mt-4 bg-muted/50 border flex items-start justify-between gap-2">
                <div class="min-w-0">
                    <div class="flex items-center gap-2 mb-1">
                        <span class="font-mono text-sm font-semibold text-primary">{{ chosen.key }}</span>
                        <span class="text-[10px] px-1.5 py-0.5 bg-secondary text-muted-foreground">{{ chosen.connectionName }}</span>
                    </div>
                    <p class="text-sm text-muted-foreground line-clamp-2">{{ chosen.summary }}</p>
                </div>
                <button type="button" class="legacy-button size-6 p-0" aria-label="Clear selected Jira issue" (click)="clear()"><svg lucideX class="size-4"></svg></button>
            </div>
        } @else if (state(); as result) {
            @if (result !== 'loading' && (result.errors.length || result.results.length)) {
                <div class="legacy-popover max-h-[300px] overflow-auto mt-1">
                    @for (error of result.errors; track error.connectionId) {
                        <p class="grid px-3 py-2 border-b text-sm bg-destructive/10 text-destructive"><strong class="text-xs">{{ error.connectionName }}</strong>{{ error.error }}</p>
                    }
                    @for (match of result.results; track match.connectionId + ':' + match.key) {
                        <button class="w-full text-left px-3 py-2 hover:bg-accent flex items-start gap-2 border-b last:border-0"
                            type="button" (click)="choose(match)">
                            <span class="font-mono text-[10px] font-semibold bg-secondary px-1.5 py-0.5 shrink-0">{{ match.key }}</span>
                            <span class="grid flex-1 min-w-0">
                                <span class="text-sm truncate">{{ match.summary }}</span>
                                <span class="text-[10px] text-muted-foreground">{{ match.connectionName }}</span>
                            </span>
                        </button>
                    }
                </div>
            }
        }
    `,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class JiraIssuePicker {
    private readonly api = inject(DESKTOP_API);
    readonly preview = input(false);
    readonly selected = output<JiraIssue>();
    readonly cleared = output<void>();
    protected readonly issue = signal<JiraIssue | null>(null);
    protected readonly query = new FormControl('', { nonNullable: true });
    protected readonly state = toSignal(this.query.valueChanges.pipe(
        map(value => value.trim()),
        debounceTime(250),
        distinctUntilChanged(),
        switchMap(query => query.length < 2 ? of(null) : from(this.api.searchJiraIssuesAllConnections(query)).pipe(
            startWith('loading' as const),
            catchError(error => of({ results: [], errors: [{ connectionId: 0, connectionName: 'Jira', error: errorMessage(error) }] }))
        ))
    ), { initialValue: null });

    protected choose(issue: JiraIssue): void {
        this.issue.set(issue);
        this.selected.emit(issue);
    }

    protected clear(): void {
        this.issue.set(null);
        this.cleared.emit();
    }
}
