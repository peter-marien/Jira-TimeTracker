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

Update version number in package.json and run:

```bash
# Release new version to GitHub
npm run release 
```

New draft release will created in Github and a new tag tag is set in Git.

## 📂 Data & Configuration

The application stores its data in a local SQLite database named `jira-timetracker.db`. You can find and configure the database path within the application settings.

By default, the database is stored in the user's application data folder:
- **Windows**: `%APPDATA%/Roaming/jira-timetracker-app/jira-timetracker.db`
- **Linux**: `~/.config/jira-timetracker-app/jira-timetracker.db`
- **macOS**: `~/Library/Application Support/jira-timetracker-app/jira-timetracker.db`

You can change this location in **Settings -> Database**.

## 📄 License

This project is personal software. All rights reserved.
