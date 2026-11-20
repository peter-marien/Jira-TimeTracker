import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { PageEvent } from '@angular/material/paginator';
import { LucideChevronLeft, LucideChevronRight } from '@lucide/angular';

@Component({
    selector: 'app-page-controls',
    imports: [LucideChevronLeft, LucideChevronRight],
    template: `
        <div class="flex items-center justify-between px-2">
            <span class="text-sm text-muted-foreground">Showing {{ total() ? page() * size() + 1 : 0 }}-{{ last() }} of {{ total() }} {{ noun() }}</span>
            @if (count() > 1) {
                <nav class="flex items-center gap-1" aria-label="Results pages">
                    <button class="legacy-button h-9" [disabled]="page() === 0" (click)="go(page() - 1)"><svg lucideChevronLeft class="size-4"></svg> Previous</button>
                    @for (number of pages(); track $index) {
                        @if (number !== null) {
                            <button class="legacy-button legacy-icon" [class.legacy-outline]="number === page()" [attr.aria-current]="number === page() ? 'page' : null" (click)="go(number)">{{ number + 1 }}</button>
                        } @else { <span class="px-3 text-muted-foreground">…</span> }
                    }
                    <button class="legacy-button h-9" [disabled]="page() + 1 >= count()" (click)="go(page() + 1)">Next <svg lucideChevronRight class="size-4"></svg></button>
                </nav>
            }
        </div>
    `,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class PageControls {
    readonly total = input.required<number>();
    readonly page = input.required<number>();
    readonly size = input.required<number>();
    readonly noun = input('results');
    readonly changed = output<PageEvent>();
    protected readonly count = computed(() => Math.ceil(this.total() / this.size()));
    protected readonly last = computed(() => Math.min((this.page() + 1) * this.size(), this.total()));
    protected readonly pages = computed(() => {
        const count = this.count();
        if (count <= 5) return Array.from({ length: count }, (_, index) => index);
        const first = Math.max(1, this.page() - 1);
        const last = Math.min(count - 2, this.page() + 1);
        return [0, ...(first > 1 ? [null] : []), ...Array.from({ length: last - first + 1 }, (_, index) => first + index),
            ...(last < count - 2 ? [null] : []), count - 1];
    });
    protected go(index: number): void {
        this.changed.emit({ pageIndex: index, pageSize: this.size(), length: this.total(), previousPageIndex: this.page() });
    }
}
