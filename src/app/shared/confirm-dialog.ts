import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';

interface Confirmation {
    title: string;
    message: string;
    action: string;
    destructive?: boolean;
}

@Component({
    imports: [MatDialogModule],
    template: `
        <h2 mat-dialog-title>{{ data.title }}</h2>
        <mat-dialog-content><p class="legacy-dialog-description">{{ data.message }}</p></mat-dialog-content>
        <mat-dialog-actions align="end">
            <button class="legacy-button legacy-outline h-10 px-4" [mat-dialog-close]="false" cdkFocusInitial>Cancel</button>
            <button class="legacy-button h-10 px-4" [class.legacy-primary]="!data.destructive" [class.legacy-destructive]="data.destructive" [mat-dialog-close]="true">{{ data.action }}</button>
        </mat-dialog-actions>
    `,
    styles: ['mat-dialog-content { padding-top:8px !important; }'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ConfirmDialog {
    protected readonly data = inject<Confirmation>(MAT_DIALOG_DATA);
}

export async function confirm(dialog: MatDialog, data: Confirmation): Promise<boolean> {
    return (await firstValueFrom(dialog.open<ConfirmDialog, Confirmation, boolean>(ConfirmDialog, { data, width: '512px', role: 'alertdialog' }).afterClosed())) === true;
}
