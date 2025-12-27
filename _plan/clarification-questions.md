Clarification Questions
1. Technology & Environment
What version of Node.js are you using? => 24.10.0
Do you have any preference for the Electron version? => No
For the Jira integration, will you be using OAuth 2.0 or API tokens (or both)? => API Tokens

2. Database & Storage
You mentioned SQLite. Should we use a specific ORM/library (e.g., better-sqlite3, sql.js, Prisma, TypeORM)? => choose what you think is best
For the database location being configurable - should there be a "Browse" dialog to let users pick the location, or just a text input? => Browse dialog

3. Timeline Visualization
For the timeline graphical overview on the dashboard, do you have a specific visualization in mind (e.g., gantt-chart-like bars, continuous timeline, blocks)? => continuous timeline
Should it show gaps between time slices visually? => No

4. Work Item Features
When importing from Jira, should we support:
Searching/filtering Jira issues (by status, assignee, project)? => by jira key or summary
Bulk import of multiple issues at once?
Should imported work items sync their descriptions automatically from Jira, or remain static once imported? => static once imported

5. Time Tracking Behavior
When a user "starts tracking time" on a work item:
Should it automatically STOP any currently running timer? => Yes
Should multiple timers be allowed to run simultaneously? => No
Should there be a visual indicator (e.g., system tray, always-visible widget) showing active tracking? => Yes

6. Sync to Jira Behavior
When syncing worklogs to Jira for a day:
Should we aggregate multiple time slices for the same work item into one worklog? => No
Or create separate worklogs for each time slice? => Yes
Should notes be synced as worklog comments? => Yes

7. Design Aesthetic Direction
Based on the frontend-design-skill guidelines, which aesthetic direction appeals to you for this productivity tool?
Refined/Minimal: Clean, spacious, professional (think Notion, Linear)
Brutalist/Raw: Bold typography, high contrast, utilitarian
Soft/Natural: Rounded corners, organic colors, calming
Editorial/Magazine: Strong grid, distinctive typography, content-focused
Or would you prefer I propose an aesthetic that fits a time-tracking/productivity context? => Yes

8. Deployment & Distribution
Will this be distributed via:
Portable executable (no installer)? => No
Installer (e.g., NSIS, Squirrel)? => Squirrel
Auto-update support needed? => Yes
Target platforms: Windows only, or also macOS/Linux? => both