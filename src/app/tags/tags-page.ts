import { ChangeDetectionStrategy, Component, inject, resource, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { LucidePencil, LucidePlus, LucideSave, LucideTag, LucideTrash2, LucideX } from '@lucide/angular';
import { MatDialog } from '@angular/material/dialog';
import type { Tag } from '@/lib/api';
import { validateTagName } from '@/lib/tags';
import { DESKTOP_API, Feedback, errorMessage } from '../core/desktop.service';
import { confirm } from '../shared/confirm-dialog';

@Component({
    imports: [ReactiveFormsModule, LucidePencil, LucidePlus, LucideSave, LucideTag, LucideTrash2, LucideX],
    templateUrl: './tags-page.html',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class TagsPage {
    private readonly api = inject(DESKTOP_API);
    private readonly dialog = inject(MatDialog);
    private readonly feedback = inject(Feedback);
    protected readonly tags = resource({ loader: () => this.api.getTags() });
    protected readonly editing = signal<number | undefined>(undefined);
    protected readonly error = signal('');
    protected readonly busy = signal(false);
    protected readonly message = errorMessage;
    protected readonly form = inject(NonNullableFormBuilder).group({
        name: ['', [Validators.required, Validators.maxLength(100)]],
        description: ['', Validators.maxLength(500)]
    });

    protected edit(tag?: Tag): void {
        this.editing.set(tag?.id);
        this.form.reset({ name: tag?.name ?? '', description: tag?.description ?? '' });
        this.error.set('');
    }

    protected async save(): Promise<void> {
        if (this.busy()) return;
        const draft = this.form.getRawValue();
        this.error.set(validateTagName(draft.name) ?? '');
        if (this.error() || this.form.invalid) return;
        this.busy.set(true);
        try {
            await this.api.saveTag({ id: this.editing(), ...draft });
            this.edit();
            this.tags.reload();
        } catch (error) { this.error.set(errorMessage(error)); }
        finally { this.busy.set(false); }
    }

    protected async remove(tag: Tag): Promise<void> {
        if (!await confirm(this.dialog, {
            title: 'Delete tag?', message: `“${tag.name}” will be unlinked from every time slice. Previously synced time slices will be marked for Jira resync.`, action: 'Delete Tag'
        })) return;
        try {
            await this.api.deleteTag(tag.id);
            if (this.editing() === tag.id) this.edit();
            this.tags.reload();
        } catch (error) { this.feedback.error(error); }
    }
}
