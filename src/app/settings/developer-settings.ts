import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { DESKTOP_API, DesktopSettings, Feedback } from '../core/desktop.service';

@Component({
    selector: 'app-developer-settings',
    template: `
        <section class="panel grid gap-4">
            <header class="space-y-1.5 mb-2"><h2 class="legacy-card-title">Developer Tools</h2><p class="text-sm text-muted-foreground">Advanced tools for debugging and development.</p></header>
            <div class="flex items-center justify-between border p-4">
                <div class="space-y-0.5"><p class="font-medium">Electron DevTools</p><p class="text-sm text-muted-foreground">Open the Electron Developer Tools window.</p></div>
                <button class="legacy-button legacy-primary h-10 px-4" (click)="api.openDevTools()">Open DevTools</button>
            </div>
            <div class="flex items-center justify-between border p-4 gap-4">
                <div class="space-y-0.5"><p class="font-medium">Application Logs</p><p class="text-sm text-muted-foreground">Open the folder containing application log files.</p></div>
                <div class="flex items-center gap-3">
                    <label class="flex items-center gap-2 text-sm text-muted-foreground">
                        <input class="control w-24 h-10" type="number" aria-label="Log retention in days" min="1" max="365" [value]="settings.values()['log_retention_days'] || '30'" (change)="saveDays($event)">days
                    </label>
                    <button class="legacy-button legacy-outline h-10 px-4" (click)="openLogs()">Show Logs</button>
                </div>
            </div>
        </section>
    `,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class DeveloperSettings {
    protected readonly api = inject(DESKTOP_API);
    protected readonly settings = inject(DesktopSettings);
    private readonly feedback = inject(Feedback);

    protected async openLogs(): Promise<void> {
        try {
            const result = await this.api.showLogs();
            if (!result.success) throw new Error(result.error || 'Could not open the logs folder.');
        } catch (error) { this.feedback.error(error); }
    }

    protected async saveDays(event: Event): Promise<void> {
        const element = event.target as HTMLInputElement;
        if (!element.value) return;
        try {
            const days = await this.api.normalizeLogRetentionDays(element.valueAsNumber);
            await this.settings.save('log_retention_days', String(days));
            element.value = String(days);
        } catch (error) { this.feedback.error(error); }
    }
}
