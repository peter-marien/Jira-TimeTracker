import { DestroyRef, Injectable, InjectionToken, computed, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { MatSnackBar } from '@angular/material/snack-bar';
import { api } from '@/lib/api';

export const DESKTOP_API = new InjectionToken('Desktop API', { factory: () => api });
export const DESKTOP_IPC = new InjectionToken('Desktop IPC', { factory: () => window.ipcRenderer });

export function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

@Injectable({ providedIn: 'root' })
export class Feedback {
    private readonly snackBar = inject(MatSnackBar);

    show(message: string): void {
        this.snackBar.open(message, 'Dismiss', { duration: 5500 });
    }

    error(error: unknown): void {
        this.show(errorMessage(error));
    }
}

@Injectable({ providedIn: 'root' })
export class DesktopSettings {
    private readonly api = inject(DESKTOP_API);
    private readonly ipc = inject(DESKTOP_IPC);
    private readonly destroyRef = inject(DestroyRef);
    private readonly document = inject(DOCUMENT);
    private readonly feedback = inject(Feedback);
    private readonly state = signal<Record<string, string>>({});
    private readonly systemDark = signal(window.matchMedia('(prefers-color-scheme: dark)').matches);
    readonly values = this.state.asReadonly();
    readonly dark = computed(() => this.isDark(this.values()['theme'] || 'dark'));
    readonly miniPlayerDark = computed(() => {
        const theme = this.values()['mini_player_theme'] || 'inverted';
        if (theme === 'inverted') return !this.dark();
        return theme === 'match' ? this.dark() : this.isDark(theme);
    });
    private initialization?: Promise<void>;

    initialize(miniPlayer = false): Promise<void> {
        return this.initialization ??= this.load(miniPlayer);
    }

    private async load(miniPlayer: boolean): Promise<void> {
        const media = window.matchMedia('(prefers-color-scheme: dark)');
        const updateTheme = () => {
            this.systemDark.set(media.matches);
            const dark = miniPlayer ? this.miniPlayerDark() : this.dark();
            this.document.documentElement.classList.toggle('dark', dark);
        };
        media.addEventListener('change', updateTheme);
        this.destroyRef.onDestroy(() => media.removeEventListener('change', updateTheme));
        const recent: Record<string, string> = {};
        if (!this.ipc) return;
        this.destroyRef.onDestroy(this.ipc.on('setting:updated', (_event, { key, value }) => {
            recent[key] = value;
            this.state.update(settings => ({ ...settings, [key]: value }));
            updateTheme();
        }));
        try {
            this.state.set({ ...await this.api.getSettings(), ...recent });
        } catch (error) {
            this.feedback.error(error);
        }
        updateTheme();
    }

    private isDark(theme: string): boolean {
        return theme === 'dark' || (theme === 'system' && this.systemDark());
    }

    async save(key: string, value: string): Promise<void> {
        await this.api.saveSetting(key, value);
    }
}

@Injectable({ providedIn: 'root' })
export class ViewDates {
    readonly day = signal(new Date());
    readonly month = signal(new Date());
    readonly year = signal(new Date().getFullYear());
}
