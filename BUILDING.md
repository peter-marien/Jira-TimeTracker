# Building and Deploying Jira Time Tracker

This project uses **Electron + Vite + React + TypeScript** and is configured with **electron-builder** for packaging.

## Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn

## Development

Run the application in development mode with hot-reload:

```bash
npm run dev
```

## Production Build

To package the application for your current platform:

```bash
npm run build
```

This will:
1. Compile TypeScript code.
2. Build the Vite production bundle.
3. Use `electron-builder` to package the app into the `release/` directory.

### Build Configuration

Packaging is configured in `electron-builder.json5`. 
- **Windows**: Produces an NSIS installer in `release/${version}`.
- **Auto-Updates**: The application is configured with `electron-updater`. Once released to a provider (like GitHub), updates will be automatically detected.

## Database Location

By default, the database is stored in the user's application data folder:
- **Windows**: `%APPDATA%/temp-app/jira-timetracker.db`
- **Linux**: `~/.config/temp-app/jira-timetracker.db`
- **macOS**: `~/Library/Application Support/temp-app/jira-timetracker.db`

You can change this location in **Settings -> Database**.

## Jira Synchronization

1. Configure your Jira connection in **Settings -> Connections**.
2. Work on items with Jira keys.
3. Click the **Sync to Jira** button on the Dashboard to upload your worklogs.
