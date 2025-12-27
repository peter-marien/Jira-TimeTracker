# Jira Time tracker

## Goal
An Electron-based time tracker app with Jira integration.
The work-items can be imported from Jira or create manually.  
A user can start tracking time on a selected work-item
The user can assign time-slices to a work-item.  
The user can add a note on the time-slice
The time-slices can be managed (split, merge, move, ...)
The work-items can be managed (split work-item, merge   
After tracking their time, the user can sync the work logs to Jira.  
The data is stored into a mySQL database

## Tech Stack
- **Frontend**: React + TypeScript + Vite + shadcn
- **Desktop**: Electron
- **Database**: SQLite
- **API**: Axios (Jira API)

## Development Guidelines
- Use modules for features

## Project Structure
- `/src`: Source code
- `/electron`: Electron main process code
- `/dist`: Build output

## Features

## General
- Dialog should be modal
- Use `shadcn` UI elements

## Dashboard
- The dashboard shows the tracked time-slices for a given day.  
    - The time-slice overview contains:
        - start, 
        - end
        - Jira key (if available)
        - work-item description
        - Notes
- A timeline is displayed a graphical overview of the timeslices
- User can manage the time-slice from a context menu on the time-slice
    - Delete time-slice
    - Edit start/end time of time-slice
    - Split time-slice
    - Move time-slice
- User can navigate to the next/previous day with buttons or select a specific date using a date-picker
- user can sync the time tracking to jira for the selected day
- User can search for an work-itme and start tracking time

## Features 
### Connect to Jira API
- Configure Jira connections in Settings.   
- Multiple multiple accounts can be managed
- One connection can be marked as the default.
- UI behavior:
  - The Jira search connection dropdown appears only when there are multiple connections.
  - The connection name badge on work-items is always shown, if no connection is attached to the work-item, no badge is shown
  
### Work-item overview
- shows an overview of all work-items
- user can import a work-item from jira
- user can manually create a work-item
- user can search for a work-item
- user can edit work-item
    - Change the Jira connection
    - Change the jira issue key
    - Change the description
    - Delete the work-item. If there are time-slices attached to a work itme, this should be prevented, the user will be informed with a pop-up message
- user can get an overview of all time-slices for the selected work-item

### Time-slice management
#### Delete time-slice
- user can delete a selected time-slice.  
- when the user wants to delete a time-slice, a confirmation pop-up should be displayed

#### Edit time-slice
- user can edit the start & end-time of a time-slice
- user can edit the notes on a time-slice

#### Move time-slice
- user can move a time-slice to another work-item

#### Split time-slice
- user can split a time-slice into multiple time-slices.  
  The user can select the work-item of each newly created time-slice

### Sync to Jira
- user can sync the time-slices for a give day to jira.  
- if there are already worklogs in jira for that day, the user should be warned.  An overview of the existing worklogs should be displayed and the user should have the possibility to:
    - Remove existing worklogs from jira
    - Add new timeslices to the worklogs
    - Cancel the operation
  
## Database

A SQLite database is used 

### Database Location

The SQLite database file is created alongside the packaged executable by default, keeping the app fully portable.  
The location of the SQLite database file can be configured in the settings.

### Tables
1. **work-item** the actual work-items
2. **time-slice** the time-slices attached to a work-item
3. **jira-connection** the settings required for connecting to Jira
4. **settings** key-value store for app settings

### Key Features
- Foreign key constraints ensure referential integrity
- Indexes on frequently queried columns (date, IDs)
- Cascade deletes for related data
- Boolean fields stored as INTEGER (0/1)
- Timestamps stored as INTEGER (Unix epoch)
- Dates stored as TEXT in ISO format (YYYY-MM-DD)
- Date-time is stored as TEXT in ISO8601 strings ("YYYY-MM-DD HH:MM:SS.SSS").

## Data Migration Process

If a data migration is needed when implementing a new feature, the migration happens automatically on first startup:
1. Check if migration has been completed
2. If not, read all data from electron-store
3. Insert data into SQLite using transactions
4. Mark migration as complete
5. Original electron-store data remains intact as backup