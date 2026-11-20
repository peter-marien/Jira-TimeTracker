import { ChangeDetectionStrategy, Component, inject, linkedSignal, resource, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { LucideSearch } from '@lucide/angular';
import { format } from 'date-fns';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import type { PageEvent } from '@angular/material/paginator';
import type { TimeSlice } from '@/lib/api';
import { DESKTOP_API, errorMessage } from '../core/desktop.service';
import { TrackingService } from '../core/tracking.service';
import { PageControls } from '../shared/page-controls';
import { TimeSliceActions } from './time-slice-actions';
import { TimeSliceTable, type SliceCommand } from './time-slice-table';

@Component({
    imports: [ReactiveFormsModule, TimeSliceTable, PageControls, LucideSearch],
    template: `
        <section class="page">
            <h1>Search Time Slices</h1>
            <label class="legacy-search max-w-md"><svg lucideSearch class="size-4 shrink-0 text-muted-foreground"></svg>
                <input aria-label="Search time slices" type="search" [formControl]="query" placeholder="Search notes, description, or Jira key...">
            </label>
            @if (results.error(); as error) { <p class="error" role="alert">{{ message(error) }}</p> }
            @if (results.isLoading()) { <p class="muted" role="status">Searching…</p> }
            @if ((results.hasValue() ? results.value() : null); as data) {
                <div>
                    <app-time-slice-table [slices]="data.items" [showDate]="true" [elapsed]="tracking.elapsedSeconds()"
                        (opened)="openDay($event)" (sliceAction)="run($event)" />
                    <app-page-controls [total]="data.total" [page]="page()" [size]="size()" (changed)="changePage($event)" />
                </div>
            } @else if (!search().trim()) {
                <p class="text-center text-muted-foreground py-20">Enter a search term to find time slices.</p>
            }
        </section>
    `,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class SearchPage {
    private readonly api = inject(DESKTOP_API);
    private readonly router = inject(Router);
    private readonly actions = inject(TimeSliceActions);
    protected readonly tracking = inject(TrackingService);
    protected readonly query = new FormControl('', { nonNullable: true });
    protected readonly search = toSignal(this.query.valueChanges.pipe(debounceTime(200), distinctUntilChanged()), { initialValue: '' });
    protected readonly page = linkedSignal(() => { this.search(); return 0; });
    protected readonly size = signal(50);
    protected readonly message = errorMessage;
    protected readonly results = resource({
        params: () => {
            const query = this.search().trim();
            return query ? { query, limit: this.size(), offset: this.page() * this.size(), revision: this.tracking.revision() } : undefined;
        },
        loader: async ({ params: { query, limit, offset } }) => {
            const [items, total] = await Promise.all([
                this.api.searchTimeSlices({ query, limit, offset }), this.api.searchTimeSlicesCount({ query })
            ]);
            return { items, total };
        }
    });

    protected changePage(event: PageEvent): void {
        this.size.set(event.pageSize);
        this.page.set(event.pageIndex);
    }

    protected openDay(slice: TimeSlice): void {
        void this.router.navigate(['/'], { queryParams: { date: format(new Date(slice.start_time), 'yyyy-MM-dd') } });
    }

    protected async run(command: SliceCommand): Promise<void> {
        if (await this.actions.run(command)) {
            if (command.action === 'resume') void this.router.navigate(['/']);
            else this.results.reload();
        }
    }
}
