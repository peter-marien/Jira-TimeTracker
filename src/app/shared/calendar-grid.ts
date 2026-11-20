import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { LucideChevronLeft, LucideChevronRight } from '@lucide/angular';
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, isToday, startOfMonth, startOfWeek } from 'date-fns';

@Component({
    selector: 'app-calendar-grid',
    imports: [LucideChevronLeft, LucideChevronRight],
    template: `
        <div class="relative flex flex-wrap gap-4 p-3 w-fit">
            <nav aria-label="Calendar navigation" class="absolute top-3 inset-x-3 flex justify-between pointer-events-none">
                <button type="button" class="legacy-button size-8 p-0 pointer-events-auto" aria-label="Previous month" (click)="move(-1)"><svg lucideChevronLeft class="size-4"></svg></button>
                <button type="button" class="legacy-button size-8 p-0 pointer-events-auto" aria-label="Next month" (click)="move(1)"><svg lucideChevronRight class="size-4"></svg></button>
            </nav>
            @for (page of pages(); track page.label) {
                <section class="w-56" [attr.aria-label]="page.label">
                    <h3 class="h-8 grid place-items-center text-sm font-medium mb-4">{{ page.label }}</h3>
                    <div class="grid grid-cols-7 text-center text-muted-foreground">
                        @for (weekday of weekdays; track weekday) { <span class="text-[.8rem] leading-normal">{{ weekday }}</span> }
                    </div>
                    <div class="grid grid-cols-7 text-center gap-y-2 mt-2">
                        @for (cell of page.cells; track cell.key) {
                            <button type="button" class="calendar-day size-8 font-normal text-sm" [class.outside]="cell.outside"
                                [class.today]="cell.today" [class.chosen]="selected().includes(cell.key)" [class.in-range]="inRange(cell.key)"
                                [attr.cdkFocusInitial]="!cell.outside && selected()[0] === cell.key ? '' : null"
                                [attr.aria-pressed]="selected().includes(cell.key)" [attr.aria-label]="cell.description"
                                (click)="chosen.emit(cell.day)">{{ cell.day.getDate() }}</button>
                        }
                    </div>
                </section>
            }
        </div>
    `,
    styles: [`
        .calendar-day:hover, .calendar-day.today, .calendar-day.in-range { background:hsl(var(--accent)); color:hsl(var(--accent-foreground)); }
        .calendar-day.outside { color:hsl(var(--muted-foreground)); }
        .calendar-day.chosen { background:hsl(var(--primary)); color:hsl(var(--primary-foreground)); }
        .calendar-day:focus-visible { position:relative; z-index:1; outline:2px solid hsl(var(--ring)); outline-offset:2px; }
    `],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class CalendarGrid {
    readonly month = input.required<Date>();
    readonly months = input(1);
    readonly selected = input<string[]>([]);
    readonly range = input(false);
    readonly monthChanged = output<Date>();
    readonly chosen = output<Date>();
    protected readonly weekdays = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
    protected readonly pages = computed(() => Array.from({ length: this.months() }, (_, index) => {
        const month = addMonths(this.month(), index);
        const weekdays = { weekStartsOn: 1 } as const;
        const days = eachDayOfInterval({ start: startOfWeek(startOfMonth(month), weekdays), end: endOfWeek(endOfMonth(month), weekdays) });
        return {
            label: format(month, 'MMMM yyyy'),
            cells: days.map(day => ({
                day, key: format(day, 'yyyy-MM-dd'), description: format(day, 'EEEE, MMMM do, yyyy'),
                outside: !isSameMonth(day, month), today: isToday(day)
            }))
        };
    }));

    protected move(amount: number): void { this.monthChanged.emit(addMonths(this.month(), amount)); }

    protected inRange(date: string): boolean {
        const [start, end] = this.selected();
        return this.range() && !!end && date > start && date < end;
    }
}
