import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { MatSelectModule } from '@angular/material/select';
import { LucideClock, LucideFilePlus2, LucideMonitor, LucideMoon, LucideRefreshCcw, LucideSun } from '@lucide/angular';
import { DESKTOP_API, DesktopSettings, Feedback } from '../core/desktop.service';
import { ColorPicker } from '../shared/color-picker';

@Component({
    selector: 'app-general-settings',
    imports: [MatSlideToggle, MatSelectModule, ColorPicker, LucideClock, LucideFilePlus2, LucideMonitor, LucideMoon, LucideRefreshCcw, LucideSun],
    templateUrl: './general-settings.html',
    styles: [`
        .field { max-width:300px; }
        .field input { background:hsl(var(--background)); color:hsl(var(--foreground)); font-weight:400; }
        .theme-option { height:78px; }
        .theme-option.selected { border-color:hsl(var(--primary)); background:color-mix(in srgb, hsl(var(--primary)) 5%, hsl(var(--background))); }
    `],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class GeneralSettings {
    private readonly settings = inject(DesktopSettings);
    private readonly api = inject(DESKTOP_API);
    private readonly feedback = inject(Feedback);
    protected readonly values = this.settings.values;
    protected readonly checking = signal(false);

    protected async save(key: string, value: string | boolean): Promise<void> {
        try { await this.settings.save(key, String(value)); }
        catch (error) { this.feedback.error(error); }
    }

    protected saveNumber(key: string, event: Event): void {
        const input = event.target as HTMLInputElement;
        if (input.value && input.reportValidity()) void this.save(key, input.value);
    }

    protected async check(): Promise<void> {
        if (this.checking()) return;
        this.checking.set(true);
        try {
            const update = await this.api.checkForUpdates();
            this.feedback.show(update.updateAvailable ? 'Update available: ' + update.version : 'You are up to date.');
        } catch (error) { this.feedback.error(error); }
        finally { this.checking.set(false); }
    }
}
