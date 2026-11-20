import type { BrowserWindow } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const appRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const developmentUrl = process.env['JIRA_TRACKER_RENDERER_URL'];
const rendererDirectory = path.join(appRoot, 'dist');
export const assetsDirectory = developmentUrl ? path.join(appRoot, 'public') : rendererDirectory;

export function loadRenderer(window: BrowserWindow, route = ''): Promise<void> {
    if (developmentUrl) {
        const target = new URL(developmentUrl);
        target.hash = route;
        return window.loadURL(target.href);
    }
    return window.loadFile(path.join(rendererDirectory, 'index.html'), route ? { hash: route } : undefined);
}
