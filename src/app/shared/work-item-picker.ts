import { ChangeDetectionStrategy, Component, computed, inject, input, output, resource, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import { CdkConnectedOverlay, CdkOverlayOrigin } from '@angular/cdk/overlay';
import { LucideChevronsUpDown, LucideSearch } from '@lucide/angular';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, combineLatest, debounceTime, distinctUntilChanged, from, map, of, startWith, switchMap } from 'rxjs';
import type { WorkItem } from '@/lib/api';
import { DESKTOP_API, DesktopSettings, Feedback } from '../core/desktop.service';
import type { JiraIssue } from '../work-items/jira-issue-picker';

type Option = WorkItem | JiraIssue;
let pickerCount = 0;
const emptySearch = { results: [], errors: [] };

@Component({
    selector: 'app-work-item-picker',
    imports: [ReactiveFormsModule, CdkConnectedOverlay, CdkOverlayOrigin, CdkTrapFocus, LucideChevronsUpDown, LucideSearch],
    template: `
        <div class="grid gap-2">
            @if (label()) { <span class="text-sm font-medium leading-none">{{ label() }}</span> }
            <button type="button" class="legacy-button legacy-outline w-full h-10 px-4 justify-between" [class.large-picker]="large()"
                cdkOverlayOrigin #anchor="cdkOverlayOrigin" aria-haspopup="dialog" [attr.aria-expanded]="open()"
                [attr.aria-label]="label() || placeholder()" (click)="toggle(anchor.elementRef.nativeElement)">
                <span class="truncate text-left">{{ selectedLabel() || placeholder() }}</span>
                <svg lucideChevronsUpDown class="ml-2 size-4 shrink-0 opacity-50"></svg>
            </button>
        </div>
        <ng-template cdkConnectedOverlay [cdkConnectedOverlayOrigin]="anchor" [cdkConnectedOverlayOpen]="open()"
            [cdkConnectedOverlayWidth]="width()" [cdkConnectedOverlayHasBackdrop]="true"
            cdkConnectedOverlayBackdropClass="cdk-overlay-transparent-backdrop"
            (backdropClick)="open.set(false)" (detach)="open.set(false)">
            <div class="legacy-popover mt-1" role="dialog" aria-label="Search work items" cdkTrapFocus [cdkTrapFocusAutoCapture]="true">
                <label class="flex items-center border-b px-3">
                    <svg lucideSearch class="mr-2 size-4 shrink-0 opacity-50"></svg>
                    <input type="search" class="h-11 w-full py-3 text-sm outline-none placeholder:text-muted-foreground"
                        placeholder="Search work items (key or description)..." aria-label="Search work items (key or description)"
                        role="combobox" aria-expanded="true" [attr.aria-controls]="listId" [attr.aria-activedescendant]="optionId()"
                        cdkFocusInitial [formControl]="query" (input)="active.set(0)" (keydown)="navigate($event)">
                </label>
                <div class="max-h-[300px] overflow-auto" role="listbox" [id]="listId" aria-label="Work item results">
                    @if (jira().errors.length) {
                        <div class="p-1" role="group" aria-label="Connection Errors">
                            <div class="px-2 py-1.5 text-xs font-medium text-muted-foreground">Connection Errors</div>
                            @for (error of jira().errors; track error.connectionId) {
                                <p class="px-2 py-1.5 text-xs bg-destructive/10 text-destructive border-l-2 border-destructive mb-1 mx-1">{{ error.connectionName }} · {{ error.error }}</p>
                            }
                        </div>
                    }
                    @if (options().length) {
                        <div class="p-1" role="group" aria-label="Results">
                            <div class="px-2 py-1.5 text-xs font-medium text-muted-foreground">Results</div>
                            @for (option of options(); track option.key; let index = $index) {
                                <div role="option" class="flex items-center gap-2 w-full px-2 py-3 text-sm cursor-default select-none"
                                    [class.bg-accent]="active() === index" [class.text-accent-foreground]="active() === index"
                                    [id]="listId + '-' + index" [attr.aria-selected]="active() === index"
                                    (pointerenter)="active.set(index)" (click)="select(option.item)">
                                    <div class="flex flex-1 min-w-0 flex-col gap-1">
                                        <div class="flex items-center justify-between gap-2 min-w-0">
                                            <span class="font-bold truncate">{{ description(option.item) }}</span>
                                            @if ('id' in option.item && option.item.is_completed) { <span class="text-[10px] bg-secondary text-muted-foreground px-1.5 py-0.5 font-medium shrink-0">Completed</span> }
                                        </div>
                                        @if (option.jiraKey) { <span class="text-xs font-mono text-primary" [style.color]="connectionColor(option.connectionId)">{{ option.jiraKey }}</span> }
                                    </div>
                                    @if (option.remote) {
                                        <svg class="size-4 text-blue-500 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                            <path d="M11.571 11.513H0a5.218 5.218 0 0 0 5.232 5.215h2.13v2.057A5.215 5.215 0 0 0 12.575 24V12.518a1.005 1.005 0 0 0-1.005-1.005zm5.723-5.756H5.736a5.215 5.215 0 0 0 5.213 5.214h2.129v2.058a5.218 5.218 0 0 0 5.215 5.214V6.758a1.001 1.001 0 0 0-1-1.001zM23 0H11.455a5.215 5.215 0 0 0 5.212 5.214h2.129v2.057A5.215 5.215 0 0 0 24 12.485V1a1 1 0 0 0-1-1z" />
                                        </svg>
                                    }
                                </div>
                            }
                        </div>
                    } @else if (!jira().errors.length) {
                        <p class="py-6 text-center text-sm">No matching work items</p>
                    }
                </div>
            </div>
        </ng-template>
    `,
    styles: ['.large-picker { height:48px; font-size:18px; }'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class WorkItemPicker {
    private readonly api = inject(DESKTOP_API);
    private readonly settings = inject(DesktopSettings);
    private readonly feedback = inject(Feedback);
    readonly label = input('Work item');
    readonly placeholder = input('Search work items or Jira');
    readonly clearOnSelect = input(false);
    readonly large = input(false);
    readonly refresh = input(0);
    readonly selected = output<WorkItem>();
    protected readonly importing = signal(false);
    protected readonly query = new FormControl('', { nonNullable: true });
    protected readonly open = signal(false);
    protected readonly width = signal(0);
    protected readonly active = signal(0);
    protected readonly selectedLabel = signal('');
    protected readonly listId = 'work-item-results-' + ++pickerCount;
    protected readonly optionId = computed(() => this.options()[this.active()] ? this.listId + '-' + this.active() : null);
    protected readonly description = (option: Option): string => 'id' in option ? option.description : option.summary;
    private readonly search = toSignal(this.query.valueChanges.pipe(
        startWith(''),
        map(value => value.trim()),
        debounceTime(180),
        distinctUntilChanged()
    ), { initialValue: '' });
    private readonly local = toSignal(combineLatest([toObservable(this.search), toObservable(this.refresh)]).pipe(
        switchMap(([query]) => from(this.api.getWorkItems({ query, limit: 50, showCompleted: true })).pipe(catchError(error => {
            this.feedback.error(error);
            return of([]);
        })))
    ), { initialValue: [] });
    protected readonly jira = toSignal(toObservable(this.search).pipe(
        switchMap(query => query.length < 2 ? of(emptySearch) : from(this.api.searchJiraIssuesAllConnections(query)).pipe(
            startWith(emptySearch),
            catchError((error: Error) => of({ results: [], errors: [{ connectionId: 0, connectionName: 'Jira', error: error.message }] }))
        ))
    ), { initialValue: emptySearch });
    protected readonly items = computed(() => this.local().filter(item =>
        !item.is_completed || this.settings.values()['hide_completed_items'] === 'false').slice(0, 25));
    protected readonly issues = computed(() => {
        const imported = new Set(this.local().map(item => item.jira_connection_id + ':' + item.jira_key));
        return this.jira().results.filter(issue => !imported.has(issue.connectionId + ':' + issue.key));
    });

    protected readonly options = computed(() => [
        ...this.items().map(item => ({ key: 'local-' + item.id, item, jiraKey: item.jira_key, connectionId: item.jira_connection_id, remote: false })),
        ...this.issues().map(item => ({ key: 'jira-' + item.connectionId + ':' + item.key, item, jiraKey: item.key, connectionId: item.connectionId, remote: true }))
    ]);
    private readonly connections = resource({
        params: () => this.open() ? true : undefined,
        loader: () => this.api.getJiraConnections()
    });

    protected connectionColor(id: number | null | undefined): string | undefined {
        return this.connections.hasValue() ? this.connections.value().find(connection => connection.id === id)?.color : undefined;
    }

    protected toggle(anchor: HTMLElement): void {
        this.width.set(anchor.getBoundingClientRect().width);
        this.active.set(0);
        this.open.update(open => !open);
    }

    protected navigate(event: KeyboardEvent): void {
        const options = this.options();
        if (!options.length) return;
        if (event.key === 'Enter') {
            event.preventDefault();
            void this.select(options[Math.min(this.active(), options.length - 1)].item);
        } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            const step = event.key === 'ArrowDown' ? 1 : -1;
            this.active.update(index => (index + step + options.length) % options.length);
            document.getElementById(this.optionId() ?? '')?.scrollIntoView({ block: 'nearest' });
        }
    }

    protected async select(option: Option): Promise<void> {
        if (this.importing()) return;
        this.importing.set(true);
        try {
            const item = 'id' in option ? option : await this.api.saveWorkItem({
                jira_connection_id: option.connectionId, jira_key: option.key, description: option.summary || option.key
            });
            this.selectedLabel.set(this.clearOnSelect() ? '' : item.description);
            this.open.set(false);
            this.query.setValue('');
            this.selected.emit(item);
        } catch (error) {
            this.feedback.error(error);
        } finally {
            this.importing.set(false);
        }
    }
}
