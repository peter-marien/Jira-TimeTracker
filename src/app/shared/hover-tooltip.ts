import { FocusMonitor } from '@angular/cdk/a11y';
import { Overlay, type ConnectedPosition, type OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { DestroyRef, Directive, ElementRef, Renderer2, TemplateRef, ViewContainerRef, inject, input } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

const above: ConnectedPosition = { originX: 'center', originY: 'top', overlayX: 'center', overlayY: 'bottom', offsetY: -4 };
const below: ConnectedPosition = { originX: 'center', originY: 'bottom', overlayX: 'center', overlayY: 'top', offsetY: 4 };
let nextTooltipId = 0;

@Directive({
    selector: '[appHoverTooltip]',
    host: {
        '(pointerenter)': 'enter($event)',
        '(pointerleave)': 'leave()',
        '(pointerdown)': 'hide()',
        '(keydown.escape)': 'hide()'
    }
})
export class HoverTooltip {
    readonly template = input.required<TemplateRef<unknown>>({ alias: 'appHoverTooltip' });
    readonly tooltipSide = input<'top' | 'bottom'>('top');
    private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    private readonly view = inject(ViewContainerRef);
    private readonly overlay = inject(Overlay);
    private readonly renderer = inject(Renderer2);
    private readonly id = 'hover-tooltip-' + ++nextTooltipId;
    private panel?: OverlayRef;
    private descriptionTarget?: HTMLElement;
    private timer?: ReturnType<typeof setTimeout>;
    private handlers: (() => void)[] = [];

    constructor() {
        const focus = inject(FocusMonitor);
        const destroy = inject(DestroyRef);
        focus.monitor(this.host, true).pipe(takeUntilDestroyed(destroy)).subscribe(origin => {
            if (origin === 'keyboard') this.show();
            if (!origin) this.hide();
        });
        destroy.onDestroy(() => {
            this.hide();
            focus.stopMonitoring(this.host);
        });
    }

    protected enter(event: PointerEvent): void {
        if (event.pointerType === 'touch') return;
        clearTimeout(this.timer);
        if (!this.panel) this.timer = setTimeout(() => this.show(), 300);
    }

    protected leave(): void {
        clearTimeout(this.timer);
        this.timer = setTimeout(() => this.hide(), 100);
    }

    protected hide(): void {
        clearTimeout(this.timer);
        if (!this.panel) return;
        for (const unlisten of this.handlers) unlisten();
        this.handlers = [];
        this.panel.dispose();
        this.panel = undefined;
        const target = this.descriptionTarget ?? this.host;
        const descriptions = (target.getAttribute('aria-describedby') || '').split(' ').filter(id => id && id !== this.id);
        if (descriptions.length) this.renderer.setAttribute(target, 'aria-describedby', descriptions.join(' '));
        else this.renderer.removeAttribute(target, 'aria-describedby');
        this.descriptionTarget = undefined;
    }

    private show(): void {
        if (this.panel) return;
        const positions = this.tooltipSide() === 'top' ? [above, below] : [below, above];
        const positionStrategy = this.overlay.position().flexibleConnectedTo(this.host)
            .withPositions(positions).withFlexibleDimensions(false).withViewportMargin(8).withPush(true);
        this.panel = this.overlay.create({
            positionStrategy, scrollStrategy: this.overlay.scrollStrategies.reposition()
        });
        const element = this.panel.overlayElement;
        this.renderer.setAttribute(element, 'role', 'tooltip');
        this.renderer.setAttribute(element, 'id', this.id);
        this.panel.attach(new TemplatePortal(this.template(), this.view));
        const target = this.host.querySelector('button') ?? this.host;
        this.descriptionTarget = target;
        const description = [target.getAttribute('aria-describedby'), this.id].filter(Boolean).join(' ');
        this.renderer.setAttribute(target, 'aria-describedby', description);
        this.handlers = [
            this.renderer.listen(element, 'pointerenter', () => clearTimeout(this.timer)),
            this.renderer.listen(element, 'pointerleave', () => this.leave())
        ];
    }
}
