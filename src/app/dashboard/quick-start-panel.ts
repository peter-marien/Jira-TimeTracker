import { ChangeDetectionStrategy, Component, computed, inject, input, output, resource } from '@angular/core';
import { LucidePlus } from '@lucide/angular';
import type { WorkItem } from '@/lib/api';
import { DESKTOP_API } from '../core/desktop.service';
import { TrackingService } from '../core/tracking.service';
import { WorkItemPicker } from '../shared/work-item-picker';
import { HoverTooltip } from '../shared/hover-tooltip';

export interface ConnectionHours {
    id: number | null;
    label: string;
    seconds: number;
    color: string;
}

@Component({
    selector: 'app-quick-start-panel',
    imports: [LucidePlus, WorkItemPicker, HoverTooltip],
    template: `
        <section class="grid grid-cols-[auto_1fr_auto] gap-8 items-start w-full max-w-(--breakpoint-2xl) mx-auto px-4 py-2 lg:min-h-[172px]">
            <div class="hidden lg:flex flex-col items-center min-w-[300px] gap-2">
                <h3 class="text-xs font-bold uppercase tracking-widest text-muted-foreground/70 text-center">Total hours</h3>
                <div class="relative size-[88px] my-1 grid place-items-center" role="img" [attr.aria-label]="'Daily goal ' + progress() + ' percent'">
                    <svg viewBox="0 0 88 88" class="absolute size-full -rotate-90">
                        <circle cx="44" cy="44" r="42" fill="none" stroke="currentColor" stroke-width="4" class="text-muted/20" />
                        @if (total()) {
                            <circle cx="44" cy="44" r="42" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"
                                pathLength="100" stroke-dasharray="100" [attr.stroke-dashoffset]="100 - progress()" class="text-primary" />
                        }
                    </svg>
                    <span class="text-[18px] font-bold">{{ hours(total()) }}</span>
                </div>
            </div>
            <div class="flex flex-col gap-3 w-full max-w-5xl min-w-[300px] md:min-w-[600px]">
                <div class="flex items-center gap-2">
                    <app-work-item-picker class="flex-1 min-w-0" label="" placeholder="Search work item to start tracking..."
                        [large]="true" [clearOnSelect]="true" [refresh]="refresh()" (selected)="started.emit($event)" />
                    <button class="legacy-button legacy-outline size-12 shrink-0 p-0" [appHoverTooltip]="importHint" aria-label="Import from Jira"
                        (click)="imported.emit()"><svg lucidePlus class="size-5"></svg></button>
                    <ng-template #importHint><div class="legacy-popover px-3 py-1.5 text-xs">Import from Jira</div></ng-template>
                </div>
                @if (recent.hasValue() && recent.value().length) {
                    <div class="flex flex-wrap gap-2 px-1">
                        <span class="text-[10px] uppercase font-bold text-muted-foreground/50 w-full mb-1 tracking-widest">Recent Activity</span>
                        @for (item of recent.value(); track item.id) {
                            <button class="inline-flex items-center px-3 py-1 text-xs font-medium border border-transparent hover:ring-2 hover:ring-primary/50 transition-all"
                                (click)="started.emit(item)" [appHoverTooltip]="hint" tooltipSide="bottom" [style.color]="badgeColor(item)"
                                [style.background]="badgeColor(item).startsWith('#') ? badgeColor(item) + '20' : item.jira_key ? 'hsl(var(--primary) / .1)' : 'hsl(var(--secondary) / .1)'">
                                <span class="max-w-[150px] truncate">{{ item.jira_key || item.description }}</span>
                            </button>
                            <ng-template #hint>
                                <div class="legacy-popover p-3 space-y-1">
                                    @if (item.jira_key) { <p class="text-[10px] font-black uppercase tracking-tighter" [style.color]="badgeColor(item)">{{ item.jira_key }}</p> }
                                    <p class="max-w-[300px] text-xs font-semibold leading-snug">{{ item.description }}</p>
                                </div>
                            </ng-template>
                        }
                    </div>
                }
            </div>
            <div class="hidden lg:flex flex-col min-w-[300px] w-[300px] pt-1 gap-2">
                <h3 class="text-xs font-bold uppercase tracking-widest text-muted-foreground/70 px-1">Total hours/connection</h3>
                <svg class="w-full h-[100px]" viewBox="0 0 300 100" role="img" aria-label="Total hours per connection">
                    @for (bar of bars(); track bar.id) {
                        <text x="82" [attr.y]="bar.center" dy=".355em" text-anchor="end" class="text-xs fill-muted-foreground">{{ bar.label }}</text>
                        <rect x="90" [attr.y]="bar.center - bar.height / 2" [attr.width]="bar.width" [attr.height]="bar.height" rx="4" [attr.fill]="bar.color" />
                        <text [attr.x]="98 + bar.width" [attr.y]="bar.center" dy=".355em" class="text-xs font-bold fill-foreground">{{ hours(bar.seconds).padStart(5, '0') }}</text>
                    }
                </svg>
            </div>
        </section>
    `,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class QuickStartPanel {
    private readonly api = inject(DESKTOP_API);
    private readonly tracking = inject(TrackingService);
    readonly total = input.required<number>();
    readonly goal = input.required<number>();
    readonly totals = input.required<ConnectionHours[]>();
    readonly refresh = input(0);
    readonly started = output<WorkItem>();
    readonly imported = output<void>();
    protected readonly bars = computed(() => {
        const totals = this.totals();
        const maximum = Math.max(1, ...totals.map(connection => Math.round(connection.seconds / 60)));
        const band = 90 / Math.max(totals.length, 1);
        return totals.map((connection, index) => ({
            ...connection, center: 5 + (index + .5) * band, height: Math.min(24, band),
            width: Math.round(connection.seconds / 60) / maximum * 170
        }));
    });
    protected readonly recent = resource({
        params: () => ({ revision: this.tracking.revision(), refresh: this.refresh() }),
        loader: () => this.api.getRecentWorkItems()
    });
    private readonly connections = resource({ params: () => this.refresh(), loader: () => this.api.getJiraConnections() });

    protected hours(seconds: number): string {
        return Math.floor(seconds / 3600) + ':' + String(Math.floor(seconds / 60) % 60).padStart(2, '0');
    }

    protected badgeColor(item: WorkItem): string {
        const connection = this.connections.hasValue() ? this.connections.value().find(value => value.id === item.jira_connection_id) : undefined;
        return connection?.color || (item.jira_key ? 'hsl(var(--primary))' : 'hsl(var(--secondary))');
    }

    protected progress(): number {
        return Math.max(0, Math.min(100, Math.round(this.total() / Math.max(1, this.goal()) * 100)));
    }
}
