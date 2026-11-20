import { ChangeDetectionStrategy, Component, ElementRef, afterRenderEffect, computed, input, signal, viewChild } from '@angular/core';
import { hourAxisTicks } from './report-data';

export interface HoursSeries {
    label: string;
    color: string;
    dashed?: boolean;
    values: number[];
}

@Component({
    selector: 'app-hours-chart',
    templateUrl: './hours-chart.html',
    styleUrl: './hours-chart.css',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class HoursChart {
    readonly heading = input.required<string>();
    readonly labels = input.required<string[]>();
    readonly dates = input<string[]>([]);
    readonly series = input.required<HoursSeries[]>();
    readonly year = input<number>();
    protected readonly annual = computed(() => this.year() !== undefined);
    private readonly plot = viewChild.required<ElementRef<HTMLDivElement>>('plot');
    protected readonly width = signal(0);
    protected readonly active = signal<number | null>(null);
    protected readonly pointerY = signal(0);
    protected readonly height = computed(() => this.annual() ? 400 : 200);
    protected readonly left = computed(() => this.annual() ? 70 : 60);
    protected readonly right = computed(() => Math.max(this.left(), this.width() - 30));
    protected readonly bottom = computed(() => this.annual() ? 313.2 : 140);
    protected readonly grid = computed(() => hourAxisTicks(Math.max(0, ...this.series().flatMap(series => series.values))));

    constructor() {
        afterRenderEffect(onCleanup => {
            const element = this.plot().nativeElement;
            const observer = new ResizeObserver(([entry]) => this.width.set(Math.round(entry.contentRect.width)));
            observer.observe(element);
            onCleanup(() => observer.disconnect());
        });
    }

    protected x(index: number): number {
        return this.left() + index * (this.right() - this.left()) / Math.max(1, this.labels().length - 1);
    }

    protected y(value: number): number {
        return this.bottom() - value * (this.bottom() - 20) / (this.grid().at(-1) || 1);
    }

    protected path(series: HoursSeries): string {
        return series.values.map((value, index) => (index ? 'L' : 'M') +
            Number(this.x(index).toFixed(3)) + ',' + Number(this.y(value).toFixed(3))).join('');
    }

    protected hover(event: PointerEvent): void {
        const bounds = this.plot().nativeElement.getBoundingClientRect();
        const x = event.clientX - bounds.left;
        const y = event.clientY - bounds.top;
        const last = this.labels().length - 1;
        const inside = x >= this.left() - 5 && x <= this.right() + 5 && y >= 20 && y <= this.bottom();
        this.active.set(inside ? Math.max(0, Math.min(last, Math.round((x - this.left()) / Math.max(1, this.right() - this.left()) * last))) : null);
        this.pointerY.set(y);
    }

    protected navigate(event: KeyboardEvent): void {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        const offset = event.key === 'ArrowLeft' ? -1 : 1;
        this.active.update(index => Math.max(0, Math.min(this.labels().length - 1, index === null ? 0 : index + offset)));
        this.pointerY.set(35);
    }

    protected overtime(index: number): number {
        const [actual, expected] = this.series();
        return Number(((actual?.values[index] ?? 0) - (expected?.values[index] ?? 0)).toFixed(1));
    }

    protected tooltipX(index: number): number {
        const x = this.x(index);
        return x < this.width() / 2 ? x + 10 : x - 10;
    }
}
