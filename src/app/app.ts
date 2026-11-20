import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet, type Routes } from '@angular/router';

@Component({
    selector: 'app-root',
    imports: [RouterOutlet],
    template: '<router-outlet />',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class App {}

export const routes: Routes = [
    { path: 'away', loadComponent: () => import('./desktop/away-page').then(module => module.AwayPage) },
    { path: 'mini-player', loadComponent: () => import('./desktop/mini-player').then(module => module.MiniPlayer) },
    {
        path: '',
        loadComponent: () => import('./desktop/app-shell').then(module => module.AppShell),
        children: [
            { path: '', pathMatch: 'full', loadComponent: () => import('./dashboard/dashboard').then(module => module.Dashboard) },
            { path: 'work-items', loadComponent: () => import('./work-items/work-items-page').then(module => module.WorkItemsPage) },
            { path: 'tags', loadComponent: () => import('./tags/tags-page').then(module => module.TagsPage) },
            { path: 'month', loadComponent: () => import('./reports/month-page').then(module => module.MonthPage) },
            { path: 'search', loadComponent: () => import('./time-slices/search-page').then(module => module.SearchPage) },
            { path: 'reports', loadComponent: () => import('./reports/reports-page').then(module => module.ReportsPage) },
            { path: 'settings', loadComponent: () => import('./settings/settings-page').then(module => module.SettingsPage) }
        ]
    },
    { path: '**', redirectTo: '' }
];
