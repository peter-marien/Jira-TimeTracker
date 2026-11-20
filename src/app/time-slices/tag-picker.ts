import { CdkConnectedOverlay, CdkOverlayOrigin } from '@angular/cdk/overlay';
import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { LucideCheck, LucideChevronsUpDown, LucideTag } from '@lucide/angular';
import type { Tag } from '@/lib/api';

@Component({
    selector: 'app-tag-picker',
    imports: [CdkConnectedOverlay, CdkOverlayOrigin, LucideCheck, LucideChevronsUpDown, LucideTag],
    template: `
        <button type="button" cdkOverlayOrigin #anchor="cdkOverlayOrigin" class="legacy-button legacy-outline w-full h-10 px-4 justify-between font-normal"
            [attr.aria-expanded]="open()" aria-haspopup="dialog" (click)="open.update(value => !value)">
            <span class="flex min-w-0 items-center gap-2">
                <svg lucideTag class="size-4 shrink-0 text-muted-foreground"></svg>
                <span class="truncate">{{ names() || 'Select tags...' }}</span>
            </span>
            <svg lucideChevronsUpDown class="size-4 shrink-0 opacity-50"></svg>
        </button>
        <ng-template cdkConnectedOverlay [cdkConnectedOverlayOrigin]="anchor" [cdkConnectedOverlayOpen]="open()"
            [cdkConnectedOverlayHasBackdrop]="true" cdkConnectedOverlayBackdropClass="cdk-overlay-transparent-backdrop"
            (backdropClick)="open.set(false)" (detach)="open.set(false)">
            <div class="legacy-popover mt-1 w-[360px] p-2" role="dialog" aria-label="Select tags">
                <div class="max-h-64 space-y-1 overflow-y-auto">
                    @for (tag of tags(); track tag.id) {
                        @let checked = selectedIds().includes(tag.id);
                        <label class="flex items-start gap-3 p-2 hover:bg-accent cursor-pointer">
                            <input type="checkbox" class="legacy-check mt-0.5" [attr.aria-label]="'Select ' + tag.name"
                                [checked]="checked" (change)="changed.emit({ id: tag.id, checked: !checked })">
                            <span class="min-w-0 flex-1">
                                <span class="flex gap-2 items-center text-sm font-medium">{{ tag.name }}
                                    @if (checked) { <svg lucideCheck class="size-3.5 text-primary"></svg> }
                                </span>
                                @if (tag.description) { <span class="block truncate text-xs text-muted-foreground">{{ tag.description }}</span> }
                            </span>
                        </label>
                    } @empty {
                        <p class="p-3 text-sm text-muted-foreground">No tags yet. Create them in the Tags module.</p>
                    }
                </div>
            </div>
        </ng-template>
    `,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class TagPicker {
    readonly tags = input.required<Tag[]>();
    readonly selectedIds = input.required<number[]>();
    readonly changed = output<{ id: number; checked: boolean }>();
    protected readonly open = signal(false);
    protected readonly names = computed(() => this.tags().filter(tag => this.selectedIds().includes(tag.id)).map(tag => tag.name).join(', '));
}
