import { CdkConnectedOverlay, CdkOverlayOrigin, type ConnectedPosition } from '@angular/cdk/overlay';
import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';

@Component({
    selector: 'app-color-picker',
    imports: [CdkConnectedOverlay, CdkOverlayOrigin],
    template: `
        <button cdkOverlayOrigin #anchor="cdkOverlayOrigin" type="button"
            class="legacy-button legacy-outline h-10 w-full justify-start"
            [attr.aria-label]="label()" [attr.aria-expanded]="open()" aria-haspopup="dialog"
            (click)="open.update(value => !value)">
            <span class="size-4 rounded-full border" [style.background]="color()"></span>
            <span class="truncate">{{ color() || 'Select color...' }}</span>
        </button>
        <ng-template cdkConnectedOverlay [cdkConnectedOverlayOrigin]="anchor" [cdkConnectedOverlayOpen]="open()"
            [cdkConnectedOverlayPositions]="positions" (overlayOutsideClick)="dismissOutside($event, anchor.elementRef.nativeElement)"
            (overlayKeydown)="dismissOnEscape($event)">
            <div class="legacy-popover w-64 p-3" role="dialog" [attr.aria-label]="label()">
                <div class="grid grid-cols-5 gap-2 mb-3">
                    @for (preset of presets; track preset) {
                        <button type="button" class="size-8 rounded-full border border-black/10 hover:scale-110 transition-transform"
                            [class.ring-2]="color() === preset" [class.ring-primary]="color() === preset" [class.ring-offset-2]="color() === preset"
                            [style.background]="preset" [attr.aria-label]="preset" [attr.aria-pressed]="color() === preset"
                            (click)="selected.emit(preset)"></button>
                    }
                </div>
                <input class="control w-full h-8" type="text" aria-label="Hex color" placeholder="#hex"
                    [value]="color()" (change)="setHex($event)">
            </div>
        </ng-template>
    `,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ColorPicker {
    readonly color = input.required<string>();
    readonly label = input('Color');
    readonly selected = output<string>();
    protected readonly open = signal(false);
    protected readonly presets = ['#10b981', '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef', '#f43f5e', '#f97316', '#f59e0b', '#64748b', '#000000'];
    protected readonly positions: ConnectedPosition[] = [
        { originX: 'center', originY: 'bottom', overlayX: 'center', overlayY: 'top', offsetY: 4 },
        { originX: 'center', originY: 'top', overlayX: 'center', overlayY: 'bottom', offsetY: -4 }
    ];

    protected setHex(event: Event): void {
        this.selected.emit((event.target as HTMLInputElement).value);
    }

    protected dismissOutside(event: MouseEvent, anchor: HTMLElement): void {
        if (!(event.target instanceof Node && anchor.contains(event.target))) this.open.set(false);
    }

    protected dismissOnEscape(event: KeyboardEvent): void {
        if (event.key === 'Escape') {
            event.stopPropagation();
            this.open.set(false);
        }
    }
}
