import { ChangeDetectionStrategy, Component, input, linkedSignal, output, signal } from '@angular/core';
import { LucideX } from '@lucide/angular';

const emptyMask = '__:__:__';
const digitSlots = [0, 1, 3, 4, 6, 7];

@Component({
    selector: 'app-clock-input',
    imports: [LucideX],
    template: `
        <div class="relative">
            <input type="text" class="control clock-control h-10 w-full font-mono text-center"
                [value]="draft()" [attr.aria-label]="label()" [attr.aria-invalid]="invalid()"
                [placeholder]="allowEmpty() ? 'Active' : 'HH:MM:SS'" inputmode="numeric" autocomplete="off"
                (focus)="showMask($event)" (beforeinput)="edit($event)" (paste)="paste($event)"
                (input)="update($event)" (blur)="accept()">
            @if (allowEmpty() && draft() && draft() !== emptyMask) {
                <button class="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:bg-accent" type="button"
                    aria-label="Clear time" (click)="clear()"><svg lucideX class="size-3"></svg></button>
            }
        </div>
        @if (invalid()) {
            <p class="text-[10px] text-destructive text-center font-medium mt-1" role="alert">Invalid time (00-23:00-59:00-59)</p>
        }
    `,
    styles: ['.clock-control { padding-right:32px; } .clock-control[aria-invalid=true] { border-color:hsl(var(--destructive)); }'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ClockInput {
    readonly label = input('Time');
    readonly value = input.required<string>();
    readonly allowEmpty = input(false);
    readonly changed = output<string>();
    protected readonly emptyMask = emptyMask;
    protected readonly draft = linkedSignal(() => this.value().length === 5 ? this.value() + ':00' : this.value());
    protected readonly invalid = signal(false);
    private readonly time = /^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/;

    protected showMask(event: FocusEvent): void {
        if (this.draft()) return;
        const input = event.target as HTMLInputElement;
        input.value = emptyMask;
        input.setSelectionRange(0, 0);
        this.draft.set(emptyMask);
    }

    protected edit(event: InputEvent): void {
        if (!event.cancelable || event.isComposing) return;
        const input = event.target as HTMLInputElement;
        if (event.inputType.startsWith('insert')) {
            const text = event.data ?? event.dataTransfer?.getData('text');
            if (text == null) return;
            event.preventDefault();
            this.insert(input, text);
        } else if (event.inputType.startsWith('delete')) {
            event.preventDefault();
            const start = input.selectionStart ?? 0;
            const end = input.selectionEnd ?? start;
            let slots = digitSlots.filter(position => position >= start && position < end);
            if (start === end) {
                const position = event.inputType.endsWith('Backward')
                    ? digitSlots.filter(slot => slot < start).at(-1)
                    : digitSlots.find(slot => slot >= start);
                slots = position === undefined ? [] : [position];
            }
            if (!slots.length) return;
            const digits = (this.draft() || emptyMask).split('');
            for (const position of slots) digits[position] = '_';
            this.write(input, digits.join(''), slots[0]);
        }
    }

    protected paste(event: ClipboardEvent): void {
        const text = event.clipboardData?.getData('text');
        if (text == null) return;
        event.preventDefault();
        this.insert(event.target as HTMLInputElement, text);
    }

    private insert(input: HTMLInputElement, text: string): void {
        const characters = text.replace(/\D/g, '');
        const slots = digitSlots.filter(position => position >= (input.selectionStart ?? 0));
        const written = slots.slice(0, characters.length);
        if (!written.length) return;
        const digits = (this.draft() || emptyMask).split('');
        const end = input.selectionEnd ?? 0;
        for (const position of slots) {
            if (position < end) digits[position] = '_';
        }
        written.forEach((position, index) => { digits[position] = characters[index]; });
        this.write(input, digits.join(''), written[written.length - 1] + 1);
    }

    private write(input: HTMLInputElement, value: string, caret: number): void {
        input.value = value;
        input.setSelectionRange(caret, caret);
        this.updateDraft(value);
    }

    protected update(event: Event): void {
        this.updateDraft((event.target as HTMLInputElement).value);
    }

    private updateDraft(draft: string): void {
        this.invalid.set(false);
        this.draft.set(draft);
        if (this.time.test(draft)) this.changed.emit(draft);
        else if (this.allowEmpty() && (!draft || draft === emptyMask)) this.changed.emit('');
    }

    protected accept(): void {
        const draft = this.draft().trim();
        if (this.allowEmpty() && (draft === '' || draft === emptyMask)) {
            this.clear();
            return;
        }
        const parts = draft.replace(/_/g, '0').split(':');
        const normalized = Array.from({ length: 3 }, (_, index) => (parts[index] || '0').padStart(2, '0')).join(':');
        this.invalid.set(parts.length > 3 || !this.time.test(normalized));
        if (!this.invalid()) {
            this.draft.set(normalized);
            this.changed.emit(normalized);
        }
    }

    protected clear(): void {
        this.draft.set('');
        this.invalid.set(false);
        this.changed.emit('');
    }
}
