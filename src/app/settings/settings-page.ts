import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatTabsModule } from '@angular/material/tabs';
import { ActivatedRoute, Router } from '@angular/router';
import { DatabaseSettings } from './database-settings';
import { DeveloperSettings } from './developer-settings';
import { GeneralSettings } from './general-settings';
import { JiraConnectionsSettings } from './jira-connections-settings';

@Component({
    imports: [MatTabsModule, DatabaseSettings, DeveloperSettings, GeneralSettings, JiraConnectionsSettings],
    template: `
        <section class="page">
            <h1>Settings</h1>
            <mat-tab-group class="legacy-tabs settings-tabs" [selectedIndex]="active()" (selectedIndexChange)="select($event)">
                <mat-tab label="General"><ng-template matTabContent><div class="tab-content"><app-general-settings /></div></ng-template></mat-tab>
                <mat-tab label="Connections"><ng-template matTabContent><div class="tab-content"><app-jira-connections-settings /></div></ng-template></mat-tab>
                <mat-tab label="Database"><ng-template matTabContent><div class="tab-content"><app-database-settings /></div></ng-template></mat-tab>
                <mat-tab label="Developer"><ng-template matTabContent><div class="tab-content"><app-developer-settings /></div></ng-template></mat-tab>
            </mat-tab-group>
        </section>
    `,
    styles: ['.tab-content { padding-block:24px 0; }'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class SettingsPage {
    private readonly tabs = ['general', 'connections', 'database', 'developer'];
    private readonly router = inject(Router);
    private readonly route = inject(ActivatedRoute);
    private readonly params = toSignal(this.route.queryParamMap);
    protected readonly active = computed(() => Math.max(0, this.tabs.indexOf(this.params()?.get('tab') ?? '')));

    protected select(index: number): void {
        if (index === this.active()) return;
        void this.router.navigate([], { relativeTo: this.route, queryParams: { tab: this.tabs[index] }, queryParamsHandling: 'merge' });
    }
}
