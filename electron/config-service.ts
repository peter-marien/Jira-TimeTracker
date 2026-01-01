import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';

const CONFIG_FILE = 'app-config.json';
const configPath = path.join(app.getPath('userData'), CONFIG_FILE);

export interface AppConfig {
    databasePath: string;
}

const DEFAULT_CONFIG: AppConfig = {
    databasePath: path.join(app.getPath('userData'), 'jira-timetracker.db')
};

export function getAppConfig(): AppConfig {
    try {
        if (!fs.existsSync(configPath)) {
            return DEFAULT_CONFIG;
        }
        const data = fs.readFileSync(configPath, 'utf-8');
        return { ...DEFAULT_CONFIG, ...JSON.parse(data) };
    } catch (e) {
        console.error('Failed to read config', e);
        return DEFAULT_CONFIG;
    }
}

export function saveAppConfig(config: Partial<AppConfig>) {
    try {
        const current = getAppConfig();
        const updated = { ...current, ...config };
        fs.writeFileSync(configPath, JSON.stringify(updated, null, 2));
    } catch (e) {
        console.error('Failed to save config', e);
    }
}
