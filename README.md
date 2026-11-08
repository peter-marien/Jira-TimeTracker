# Jira Time Tracker

A powerful, high-performance desktop application for tracking time and syncing worklogs to Jira. Built with Electron, React, and Vite, it offers a premium user experience with advanced features designed for professional workflows.

## 🚀 Key Features

- **Intuitive Dashboard**: Real-time tracking with an interactive timeline and visual overlap detection.
- **Quick Start Bar**: Rapidly search and track work items, with one-click access to your 5 most recently used tasks.
- **Jira Integration**: Native support for Jira connections with easy worklog synchronization.
- **Smart Away Detection**: Automatically detects system lock, sleep, and idle periods, allowing you to discard, keep, or reassign away time.
- **Advanced Work Item Management**: Paginated overview with total time spent calculation, sorting, and completion status.
- **Precision Tracking**: Configurable time rounding (e.g., to the nearest 15 minutes) and minimum duration enforcement.
- **Multi-Day Copy**: Effortlessly duplicate time slices to multiple future or past dates.
- **Clean Visuals**: Modern UI built with ShadCN/UI, featuring smooth animations, dark mode support, and a high-contrast Month View.
- **System Tray Integration**: Background tracking with status-aware tray icons and tooltips.

## 🛠️ Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS
- **Framework**: Electron, Vite
- **UI Components**: ShadCN/UI, Lucide Icons
- **Database**: SQLite (via `better-sqlite3`)
- **State Management**: Zustand
- **Date Handling**: date-fns

## 📦 Getting Started

### Prerequisites

- Node.js 26.13.0 LTS with npm 11.20.0 (see `.nvmrc`)
- npm or pnpm

### Installation

```bash
# Clone the repository
git clone https://github.com/peter-marien/jira-timetracker.git

# Install dependencies
npm install
```

### Development

```bash
# Start the development server
npm run dev
```

### Building

```bash
# Build for production
npm run build
```

### Tests

Run `npm test` with Node.js 26.13.0 LTS. The regression suite uses isolated,
in-memory databases and simulated Electron events; it does not open the installed
application or access your saved time entries.

After building with `npx vite build`, run `npm run test:electron` to check the built
preload in a hidden Electron window with a temporary, isolated application profile.

Run `npm run test:sqlite` after `npm ci` to check the actual native SQLite binding
with a disposable database. SQLite 13 supplies Node-API binaries shared by Node
and Electron, so packaging disables the unnecessary native rebuild. If adding
other native dependencies, reassess that setting before packaging them.
The `allowScripts` entry also prevents npm from inferring an unnecessary
`node-gyp rebuild` for SQLite during a clean install with npm 11.20.0.
The Electron smoke test also verifies native SQLite data preservation and rollback.
These checks never open your saved application database or change its schema.
Run `npm run test:app` after building to exercise application startup and renderer
routes with a temporary profile and database. This test blocks external HTTP
requests and skips OAuth protocol registration, leaving your installed app alone.

CI and release validation target Windows x64. Existing macOS DMG and Linux
AppImage settings are retained; runtime compatibility on those platforms is unverified.
Electron 45 requires macOS 13 or newer if you build the macOS target.

For hibernation changes, also verify a packaged build on Windows: stop tracking,
minimize, hibernate, and resume. Both windows should remain idle. Repeat while
tracking and after disconnecting a monitor; the active entry should remain the
same and reopening the app should show its window on an available screen.

### Continuous integration

The [CI workflow](.github/workflows/ci.yml) runs on pushes to `master` and pull
requests targeting `master`. It also supports `workflow_call`, so releases use
the same validation steps:

1. Install dependencies with `npm ci` using the Node.js version in `.nvmrc`.
2. Check lint with `npm run lint`.
3. Run regression tests with `npm test`.
4. Check TypeScript with `npx tsc --noEmit`.
5. Build the application with `npx vite build`.
6. Run the real Electron regression check with `npm run test:electron`.

CI reports failures without modifying source files or creating commits. Run
`npm run lint -- --fix` locally to apply available fixes, then review and commit
them before pushing.

Push checks run after a commit reaches GitHub. To require successful validation
before merging, configure the CI validation check as a required status check in
the branch protection settings for `master`.

### Deploy new version to GitHub

Releases are created by the manually triggered [Release workflow](.github/workflows/release.yml) in GitHub Actions.

**Prerequisites:**

- Commit and push the changes to release to `master` and check that CI passes. Fix lint failures during development; releases do not fix lint or commit code changes automatically.
- Ensure GitHub Actions can push commits and tags to `master`. The workflow requests `contents: write` and uses the built-in `GITHUB_TOKEN`; no local `.env` file or additional release token is required.

**Execution:**

1. Open the repository on GitHub and go to **Actions → Release**.
2. Select **Run workflow** and choose the `master` branch.
3. Enter `patch`, `minor`, `major`, or an explicit version such as `0.18.0` in the **new-version** field.
4. Start the workflow and check that the run completes successfully.

**The workflow automatically:**

1. Calls the reusable [CI workflow](.github/workflows/ci.yml) and waits for all validation checks to pass.
2. Checks out the same validated commit on a Windows runner, verifies `master`, installs dependencies with `npm ci`, and checks that the working tree is clean.
3. Configures `github-actions[bot]` as the Git author and runs `npm version` to update the package version and lock file, then creates a version commit and tag.
4. Pushes the version commit and tags to GitHub.
5. Runs `npm run release` to build the versioned Windows installer and publish it to GitHub Releases.

Validation failure stops the release before the version bump or any push. Validation has read-only repository permissions; only the release job can push commits, tags, and release assets.

The application build is checked before the version bump. Installer packaging and publishing still happen after the commits and tags are pushed. If packaging or upload fails, inspect the failed run before starting another version bump.

## 📂 Data & Configuration

The application stores its data in a local SQLite database named `jira-timetracker.db`. You can find and configure the database path within the application settings.

By default, the database is stored in the user's application data folder:
- **Windows**: `%APPDATA%/Roaming/jira-timetracker-app/jira-timetracker.db`
- **Linux**: `~/.config/jira-timetracker-app/jira-timetracker.db`
- **macOS**: `~/Library/Application Support/jira-timetracker-app/jira-timetracker.db`

You can change this location in **Settings -> Database**.

## 📄 License

This project is personal software. All rights reserved.

