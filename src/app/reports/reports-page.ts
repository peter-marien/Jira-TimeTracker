import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, resource } from '@angular/core';
import { LucideChevronLeft, LucideChevronRight, LucideFileChartColumnIncreasing } from '@lucide/angular';
import { endOfYear, formatISO, startOfYear } from 'date-fns';
import { DESKTOP_API, ViewDates, errorMessage } from '../core/desktop.service';
import { TrackingService } from '../core/tracking.service';
import { HoursChart } from './hours-chart';
import { yearOverview } from './report-data';

@Component({
    imports: [DecimalPipe, HoursChart, LucideChevronLeft, LucideChevronRight, LucideFileChartColumnIncreasing],
    template: `
        <section class="page reports-page">
            <header class="page-header">
                <div class="flex items-center gap-3">
                    <div class="size-10 grid place-items-center bg-primary/10 text-primary"><svg lucideFileChartColumnIncreasing class="size-6"></svg></div>
                    <div><h1>Reports</h1><p class="text-sm text-muted-foreground">Yearly performance overview</p></div>
                </div>
                <div class="flex items-center gap-4"><button class="legacy-button legacy-outline h-9" (click)="year.set(currentYear)">Today</button>
                    <button class="legacy-button legacy-outline size-10 p-0" aria-label="Previous year" (click)="year.update(previous)"><svg lucideChevronLeft class="size-4"></svg></button>
                    <strong class="w-[84px] text-center text-lg">{{ year() }}</strong>
                    <button class="legacy-button legacy-outline size-10 p-0" aria-label="Next year" [disabled]="year() >= currentYear + 1" (click)="year.update(next)"><svg lucideChevronRight class="size-4"></svg></button>
                </div>
            </header>
            @if (data.error(); as failure) { <p class="error" role="alert">{{ message(failure) }}</p> }
            @else if (data.isLoading()) { <p role="status">Loading annual report…</p> }
            @else {
                <div class="w-full max-w-5xl mx-auto grid gap-4">
                    @if (data.value()?.length) {
                    <div class="flex flex-wrap gap-6 border bg-card/50 p-4">
                        <div class="metric"><span>Total Actual</span><strong class="text-primary">{{ totals().actual | number:'1.0-0' }}h</strong></div>
                        <div class="metric"><span>Total Expected</span><strong class="text-muted-foreground">{{ totals().expected }}h</strong></div>
                        <div class="metric"><span>Completion</span><strong>{{ totals().actual / totals().expected * 100 | number:'1.0-0' }}%</strong></div>
                        <div class="metric"><span>Overtime</span><strong [class.text-red-400]="overtime() <= 0" [class.text-emerald-500]="overtime() > 0">{{ overtime() > 0 ? '+' : '' }}{{ overtime() }}h</strong></div>
                    </div>
                    <app-hours-chart heading="Yearly Overview" [year]="year()" [labels]="labels()" [series]="series()" />
                    } @else {
                        <div class="grid place-items-center h-[400px] border bg-card text-muted-foreground">No data available for {{ year() }}</div>
                    }
                </div>
            }
        </section>
    `,
    styles: [`
        .metric { display:grid; }
        .metric + .metric { border-left:1px solid hsl(var(--border)); padding-left:24px; }
        .metric span { font-weight:700; font-size:12px; line-height:16px; text-transform:uppercase; letter-spacing:.05em; color:hsl(var(--muted-foreground)); }
        .metric strong { font-size:24px; line-height:32px; }
    `],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReportsPage {
    private readonly api = inject(DESKTOP_API);
    private readonly tracking = inject(TrackingService);
    protected readonly year = inject(ViewDates).year;
    protected readonly currentYear = new Date().getFullYear();
    protected readonly previous = (year: number) => year - 1;
    protected readonly next = (year: number) => year + 1;
    protected readonly message = errorMessage;
    protected readonly data = resource({
        params: () => ({ year: this.year(), revision: this.tracking.revision() }),
        loader: ({ params }) => {
            const date = new Date(params.year, 0, 1);
            return this.api.getTimeSlices(formatISO(startOfYear(date)), formatISO(endOfYear(date)));
        }
    });
    private readonly months = computed(() => yearOverview(this.year(), this.data.hasValue() ? this.data.value() : [], Date.now()));
    protected readonly labels = computed(() => this.months().map(month => month.label));
    protected readonly series = computed(() => [
        { label: 'Actual Hours', color: 'hsl(var(--primary))', values: this.months().map(month => month.actual) },
        { label: 'Expected (8h/day)', color: '#94a3b8', dashed: true, values: this.months().map(month => month.expected) }
    ]);
    protected readonly totals = computed(() => this.months().reduce((sum, month) =>
        ({ actual: sum.actual + month.actual, expected: sum.expected + month.expected }), { actual: 0, expected: 0 }));
    protected readonly overtime = computed(() => Number((this.totals().actual - this.totals().expected).toFixed(1)));
}
