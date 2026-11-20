import { CdkConnectedOverlay, CdkOverlayOrigin } from '@angular/cdk/overlay';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { LucideCalendar, LucideChevronLeft, LucideChevronRight, LucideClock } from '@lucide/angular';
import { addDays, format, isToday, parseISO } from 'date-fns';
import { CalendarGrid } from './calendar-grid';
import { ClockInput } from './clock-input';

@Component({
    selector: 'app-day-picker',
    imports: [CdkConnectedOverlay, CdkOverlayOrigin, CdkTrapFocus, LucideCalendar, LucideChevronLeft, LucideChevronRight, LucideClock, CalendarGrid, ClockInput],
    template: `
        <div class="flex items-center gap-1">
            @if (navigate() && !isToday(day())) {
                <button class="legacy-button legacy-outline mr-2 h-8" (click)="selected.emit(today())">Today</button>
            }
            @if (navigate()) { <button type="button" class="legacy-button size-10 p-0" aria-label="Previous day" (click)="step(-1)"><svg lucideChevronLeft class="size-4"></svg></button> }
            <button type="button" cdkOverlayOrigin #anchor="cdkOverlayOrigin" class="legacy-button legacy-outline h-10 justify-start px-4 font-normal"
                [class]="navigate() ? 'w-[280px]' : 'w-full'"
                [disabled]="disabled()" [attr.aria-expanded]="open()" aria-haspopup="dialog" (click)="toggle()">
                <svg lucideCalendar class="mr-2 size-4" [class.text-muted-foreground]="!hasValue()"></svg>
                @if (hasValue()) {
                    {{ label() }}
                    @if (withTime()) { <svg lucideClock class="size-4 text-muted-foreground"></svg>{{ timeLabel() }} }
                } @else { <span class="text-muted-foreground">{{ placeholder() }}</span> }
            </button>
            @if (navigate()) {
                <button type="button" class="legacy-button size-10 p-0" aria-label="Next day" (click)="step(1)"><svg lucideChevronRight class="size-4"></svg></button>
                <input class="sr-only" type="date" aria-label="Selected day" [value]="dateKey()" tabindex="-1" (change)="selectInput($event)">
            }
        </div>
        <ng-template cdkConnectedOverlay [cdkConnectedOverlayOrigin]="anchor" [cdkConnectedOverlayOpen]="open()"
            [cdkConnectedOverlayHasBackdrop]="true" cdkConnectedOverlayBackdropClass="cdk-overlay-transparent-backdrop"
            (backdropClick)="open.set(false)" (detach)="open.set(false)">
            <section role="dialog" aria-label="Choose date" class="calendar mt-1 legacy-popover"
                cdkTrapFocus [cdkTrapFocusAutoCapture]="true" (keydown.escape)="open.set(false)">
                <app-calendar-grid [month]="month()" [selected]="hasValue() ? [dateKey()] : []"
                    (monthChanged)="month.set($event)" (chosen)="choose($event)" />
                @if (withTime()) {
                    <div class="flex items-center gap-2 border-t p-3">
                        <svg lucideClock class="size-4 text-muted-foreground"></svg><app-clock-input class="min-w-0 flex-1" [value]="timeInput()" (changed)="setTime($event)" />
                    </div>
                }
            </section>
        </ng-template>
    `,
    styles: ['.calendar { background:hsl(var(--background)); }'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class DayPicker {
    readonly day = input.required<Date>();
    readonly navigate = input(true);
    readonly withTime = input(false);
    readonly hasValue = input(true);
    readonly disabled = input(false);
    readonly placeholder = input('Pick a date');
    readonly selected = output<Date>();
    protected readonly open = signal(false);
    protected readonly month = signal(new Date());
    protected readonly label = computed(() => this.withTime() ? format(this.day(), 'PPP') : this.describe(this.day()));
    protected readonly timeLabel = computed(() => format(this.day(), 'HH:mm'));
    protected readonly dateKey = computed(() => format(this.day(), 'yyyy-MM-dd'));
    protected readonly timeInput = computed(() => format(this.day(), 'HH:mm:ss'));
    protected readonly isToday = isToday;
    protected today(): Date { return new Date(); }
    protected describe(day: Date): string { return format(day, 'EEEE, MMMM do, yyyy'); }
    protected step(by: number): void { this.selected.emit(addDays(this.day(), by)); }
    protected toggle(): void { if (!this.open()) this.month.set(this.day()); this.open.update(open => !open); }
    protected choose(date: Date): void {
        if (this.withTime()) {
            const value = new Date(date);
            value.setHours(this.day().getHours(), this.day().getMinutes(), 0, 0);
            this.selected.emit(value);
            return;
        }
        this.selected.emit(date);
        this.open.set(false);
    }
    protected setTime(time: string): void {
        const [hours, minutes, seconds] = time.split(':').map(Number);
        const date = new Date(this.day());
        date.setHours(hours, minutes, seconds, 0);
        this.selected.emit(date);
    }
    protected selectInput(event: Event): void {
        const value = (event.target as HTMLInputElement).value;
        if (value) this.choose(parseISO(value));
    }
}
