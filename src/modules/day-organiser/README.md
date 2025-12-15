# Day Organiser Module

A comprehensive day organization module for Quasar Framework that stores data in JSON format (localStorage for web, file system for desktop/mobile).

## Features

- ✅ Create, read, update, delete tasks
- ✅ Task categorization (work, personal, meeting, other)
- ✅ Priority levels (low, medium, high)
- ✅ Time-based scheduling (start/end times)
- ✅ Task completion tracking
- ✅ Daily notes
- ✅ Date navigation (previous/next day, go to today)
- ✅ Export/Import data as JSON
- ✅ Date range queries
- ✅ Filter by category, priority, completion status
- ✅ Persistent storage (localStorage for web)

## File Structure

```
src/modules/day-organiser/
├── index.ts              # Main export file
├── types.ts              # TypeScript interfaces
├── storage.ts            # Data persistence layer
└── useDayOrganiser.ts    # Vue composable with all functionality
```

## Usage

### Basic Setup

```typescript
import { useDayOrganiser } from '@/modules/day-organiser';

const {
  isLoading,
  currentDate,
  currentDayData,
  loadData,
  addTask,
  deleteTask,
  toggleTaskComplete,
} = useDayOrganiser();

// Load data on mount
onMounted(async () => {
  await loadData();
});
```

### Adding a Task

```typescript
await addTask(currentDate.value, {
  title: 'Team Meeting',
  description: 'Weekly team sync',
  startTime: '10:00',
  endTime: '11:00',
  date: currentDate.value,
  category: 'meeting',
  priority: 'high',
  completed: false,
  tags: ['team', 'weekly'],
});
```

### Updating a Task

```typescript
await updateTask(currentDate.value, taskId, {
  title: 'Updated Title',
  priority: 'low',
  completed: true,
});
```

### Deleting a Task

```typescript
await deleteTask(currentDate.value, taskId);
```

### Toggle Task Completion

```typescript
await toggleTaskComplete(currentDate.value, taskId);
```

### Working with Date Ranges

```typescript
// Get all tasks in a week
const weekTasks = getTasksInRange('2025-11-20', '2025-11-27');

// Get incomplete tasks across all dates
const incompleteTasks = getIncompleteTasks();

// Get tasks by category
const workTasks = getTasksByCategory('work');

// Get high priority tasks
const urgentTasks = getTasksByPriority('high');
```

### Navigation

```typescript
// Go to today
goToToday();

// Navigate days
nextDay();
prevDay();

// Jump to specific date
setCurrentDate('2025-12-25');
```

### Export/Import Data

```typescript
// Export data as JSON file
exportData();

// Import data from file
const file = event.target.files[0];
await importData(file);
```

### Update Day Notes

```typescript
await updateDayNotes(currentDate.value, 'Great productive day!');
```

## Data Structure

### Task Interface

```typescript
interface Task {
  id: string;
  title: string;
  description: string;
  startTime: string; // HH:mm format
  endTime: string; // HH:mm format
  date: string; // YYYY-MM-DD format
  category: 'work' | 'personal' | 'meeting' | 'other';
  priority: 'low' | 'medium' | 'high';
  completed: boolean;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}
```

### DayData Interface

```typescript
interface DayData {
  date: string;
  tasks: Task[];
  notes?: string;
}
```

## Storage

### Web (Default)

- Uses `localStorage` with key: `day-organiser-data`
- Data persists in browser
- Export to JSON for backup

### Desktop (Electron)

To implement file system storage for Electron:

1. Update `storage.ts`:

```typescript
import { ipcRenderer } from 'electron';

async loadData() {
  const data = await ipcRenderer.invoke('load-organiser-data');
  return data;
}

async saveData(data) {
  await ipcRenderer.invoke('save-organiser-data', data);
}
```

2. Add IPC handlers in Electron main process

### Mobile (Capacitor)

To implement file system storage for Capacitor:

1. Install Filesystem plugin:

```bash
npm install @capacitor/filesystem
```

2. Update `storage.ts`:

```typescript
import { Filesystem, Directory } from '@capacitor/filesystem';

async loadData() {
  const file = await Filesystem.readFile({
    path: 'organiser.json',
    directory: Directory.Data,
  });
  return JSON.parse(file.data);
}

async saveData(data) {
  await Filesystem.writeFile({
    path: 'organiser.json',
    directory: Directory.Data,
    data: JSON.stringify(data),
  });
}
```

## Example Component

See `src/pages/DayOrganiserPage.vue` for a complete implementation with:

- Task list display
- Add task form
- Date navigation
- Task completion toggle
- Export/Import buttons
- Day notes editor

## Route Setup

Add to your router:

```typescript
{
  path: '/organiser',
  component: () => import('pages/DayOrganiserPage.vue')
}
```

## Customization

### Add Custom Task Properties

1. Update `types.ts`:

```typescript
export interface Task {
  // ... existing properties
  location?: string;
  attendees?: string[];
  color?: string;
}
```

2. Update forms and displays accordingly

### Change Storage Backend

Modify `storage.ts` to use:

- IndexedDB for larger datasets
- Backend API for multi-device sync
- Firebase/Supabase for cloud storage

## License

MIT
