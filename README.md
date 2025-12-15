# Community Organiser

A comprehensive task and community management application designed to help organize small groups, personal tasks, and daily routines with minimal stress.

## Overview

Community Organiser helps you manage various aspects of your life - from organizing your child's kindergarten activities to managing family schedules, personal accounting, and small business tasks. Built with Quasar Framework for cross-platform compatibility (Web, Desktop, Mobile).

## Key Features

### Current Features

- **Hierarchical Group Management** - Organize tasks into groups and subgroups
- **Active Group Workspace** - Work within a specific group context for focused task management
- **Task Organization** - Create, manage, and track daily tasks with priorities, categories, and durations
- **Daily Notes** - Add contextual notes for each day
- **Local Data Storage** - Automatic JSON file saving with Electron (desktop) or localStorage (web)
- **Data Import/Export** - Backup and restore your data easily
- **First-Run Experience** - Guided setup for new users

### Planned Features

- **Recurring Tasks** - Cyclical routines for meetings, parties, and regular activities
- **Meeting Planner** - Schedule meetings with availability sharing and collaborative date selection
- **Backend Synchronization** - Sync with Laravel API for multi-device access
- **Accounting Module** - Simple bookkeeping for small organizations
- **Smart Notifications** - Serverless notification system via phone/Electron app
- **Peer-to-Peer Sync** - Synchronize data without requiring a central server
- **Item State Tracking** - Monitor status of fixed items (e.g., car parts, equipment)
- **Template System** - Create events from precedents with optional AI assistance

## Technology Stack

- **Frontend**: Quasar Framework v2 (Vue 3, TypeScript)
- **Desktop**: Electron
- **Styling**: Quasar Components
- **Data Storage**: JSON files (Electron), localStorage (Web)

## Getting Started

### Install the dependencies

```bash
npm install
# or
yarn install
```

### Development

#### Start the web app in development mode

Hot-code reloading, error reporting, etc.

```bash
quasar dev
# or
npm run dev
```

#### Start the Electron desktop app

```bash
npm run electron
```

### Production

#### Build for web

```bash
quasar build
```

#### Build for Electron (desktop)

```bash
npm run build:electron
```

### Code Quality

#### Lint the files

```bash
npm run lint
# or
yarn lint
```

#### Format the files

```bash
npm run format
# or
yarn format
```

## Usage

1. **First Launch**: Create your first group when prompted - this becomes your active workspace
2. **Active Group**: Select a group from the dropdown to set your working context
3. **Add Tasks**: Tasks are automatically assigned to your active group
4. **View All**: Select "All Groups" to see tasks across all groups (viewing only)
5. **Manage Groups**: Click the "Groups" button to create, organize, or delete groups
6. **Data Location**: Click "Data Location" to see where your data is stored

## Data Storage

- **Desktop (Electron)**: Data is automatically saved to `%APPDATA%/community-organiser/organiser-data.json`
- **Web**: Data is stored in browser localStorage

## Configuration

See [Configuring quasar.config.js](https://v2.quasar.dev/quasar-cli-vite/quasar-config-js) for customization options.
