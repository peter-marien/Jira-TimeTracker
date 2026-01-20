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

- Node.js (Latest LTS recommended)
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

### Deploy new version to GitHub

The project includes an agentic workflow for safe and automated releases.

**Prerequisites:**
- Ensure you have a `.env` file with a valid GitHub token in the root: `GH_TOKEN=[YOUR_GITHUB_TOKEN]`.
- Be on the `master` branch with a clean working tree.

**Execution:**
You can trigger the release by asking the AI assistant:
```text
/release-github [new-version]
```
Where `[new-version]` can be a specific version (e.g., `0.8.4`) or an npm version keyword (`patch`, `minor`, `major`).

**The workflow automatically:**
1. Validates the branch and working tree.
2. Fixes linting issues automatically.
3. Bumps `package.json` version and creates a Git commit/tag.
4. Pushes changes and tags to GitHub.
5. Builds the production installer and uploads it to GitHub Releases.

## 📂 Data & Configuration

The application stores its data in a local SQLite database named `jira-timetracker.db`. You can find and configure the database path within the application settings.

By default, the database is stored in the user's application data folder:
- **Windows**: `%APPDATA%/Roaming/jira-timetracker-app/jira-timetracker.db`
- **Linux**: `~/.config/jira-timetracker-app/jira-timetracker.db`
- **macOS**: `~/Library/Application Support/jira-timetracker-app/jira-timetracker.db`

You can change this location in **Settings -> Database**.

## 📄 License

This project is personal software. All rights reserved.
