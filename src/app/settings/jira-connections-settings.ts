import { ChangeDetectionStrategy, Component, inject, resource } from '@angular/core';
import { CdkMenuModule } from '@angular/cdk/menu';
import { LucideEllipsis, LucidePencil, LucidePlus, LucideTrash2 } from '@lucide/angular';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import type { JiraConnection } from '@/lib/api';
import { DESKTOP_API, Feedback, errorMessage } from '../core/desktop.service';
import { actionMenuPositions } from '../shared/action-menu';
import { confirm } from '../shared/confirm-dialog';
import { JiraConnectionDialog } from './jira-connection-dialog';

@Component({
    selector: 'app-jira-connections-settings',
    imports: [CdkMenuModule, LucideEllipsis, LucidePencil, LucidePlus, LucideTrash2],
    template: `
        <section class="space-y-4">
            <header class="page-header"><h2 class="font-medium">Jira Connections</h2><button class="legacy-button legacy-outline h-9" (click)="edit()"><svg lucidePlus class="size-4 mr-2"></svg>Add Connection</button></header>
            @if (connections.error(); as error) { <p class="error" role="alert">{{ message(error) }}</p> }
            @else if (connections.isLoading()) { <p role="status">Loading Jira connections…</p> }
            @else {
                <div class="scroll-table border bg-card">
                    <table aria-label="Jira connections" class="text-sm">
                        <thead class="bg-secondary/50"><tr><th scope="col" class="w-[200px]">Name</th><th scope="col">Base URL</th><th scope="col" class="w-[150px]">Auth</th><th scope="col" class="w-[150px]">Status</th><th scope="col" class="w-[100px] text-right">Actions</th></tr></thead>
                        <tbody>
                            @for (connection of connections.value() ?? []; track connection.id) {
                                <tr class="hover:bg-accent/50">
                                    <td class="font-medium"><div class="flex gap-2 items-center">@if (connection.color) { <span class="size-3 rounded-full border" [style.background]="connection.color"></span> }{{ connection.name }}</div></td>
                                    <td class="text-muted-foreground truncate max-w-[300px]" [title]="connection.base_url">{{ connection.base_url }}</td>
                                    <td>@if (connection.auth_type === 'oauth') { <span class="px-2 py-0.5 text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800">OAuth</span> }
                                        @else { <span class="text-muted-foreground">{{ connection.email }}</span> }</td>
                                    <td>
                                        @if (connection.is_default) { <span class="px-2 py-0.5 text-xs font-semibold bg-primary/10 text-primary mr-1">Default</span> }
                                        @if (!connection.is_enabled) { <span class="px-2 py-0.5 text-xs font-medium text-muted-foreground border border-dashed">Disabled</span> }
                                    </td>
                                    <td class="text-right">
                                        <button type="button" class="legacy-button size-8 p-0" [cdkMenuTriggerFor]="menu"
                                            [cdkMenuPosition]="menuPositions" aria-label="Connection actions"><svg lucideEllipsis class="size-4"></svg></button>
                                        <ng-template #menu>
                                            <div cdkMenu class="legacy-popover action-menu" aria-label="Connection actions">
                                                <button cdkMenuItem (cdkMenuItemTriggered)="edit(connection)"><svg lucidePencil class="size-4"></svg>Edit</button>
                                                <button cdkMenuItem class="text-destructive" (cdkMenuItemTriggered)="remove(connection)"><svg lucideTrash2 class="size-4"></svg>Delete</button>
                                            </div>
                                        </ng-template>
                                    </td>
                                </tr>
                            } @empty { <tr><td colspan="5" class="text-center py-8 text-muted-foreground italic">No connections configured. Add one to get started.</td></tr> }
                        </tbody>
                    </table>
                </div>
            }
        </section>
    `,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class JiraConnectionsSettings {
    protected readonly menuPositions = actionMenuPositions;
    private readonly api = inject(DESKTOP_API);
    private readonly dialog = inject(MatDialog);
    private readonly feedback = inject(Feedback);
    protected readonly connections = resource({ loader: () => this.api.getJiraConnections() });
    protected readonly message = errorMessage;

    protected async edit(connection: JiraConnection | null = null): Promise<void> {
        if (await firstValueFrom(this.dialog.open(JiraConnectionDialog, { data: connection, width: '500px' }).afterClosed())) this.connections.reload();
    }

    protected async remove(connection: JiraConnection): Promise<void> {
        if (!await confirm(this.dialog, { title: 'Delete Connection?', message: `Are you sure you want to delete "${connection.name}"? Work items linked to this connection may lose their reference.`, action: 'Delete', destructive: true })) return;
        try { await this.api.deleteJiraConnection(connection.id); this.connections.reload(); }
        catch (error) { this.feedback.error(error); }
    }
}
