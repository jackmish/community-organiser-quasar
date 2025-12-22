import { ref, computed } from 'vue';
import type { OrganiserData, DayData, Task, TaskGroup } from './types';
import { storage } from './storage';
import { generateGroupId } from './groupId';

// Generate unique ID
const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// Format date to YYYY-MM-DD
const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0] ?? '';
};

// Reactive state
const organiserData = ref<OrganiserData>({
  days: {},
  groups: [],
  lastModified: new Date().toISOString(),
});

const isLoading = ref(false);
const currentDate = ref(formatDate(new Date()));

export function useDayOrganiser() {
  // Load data from storage
  const loadData = async () => {
    isLoading.value = true;
    try {
      const data = await storage.loadData();
      organiserData.value = data;
      const dirPath = await storage.getDataFilePathPublic();
      console.log('Loaded organiser data:', data);
      console.log('Loaded from directory:', dirPath);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      isLoading.value = false;
    }
  };

  // Save data to storage
  const saveData = async () => {
    try {
      await storage.saveData(organiserData.value);
    } catch (error) {
      console.error('Failed to save data:', error);
      throw error;
    }
  };

  // Get day data for a specific date
  const getDayData = (date: string): DayData => {
    if (!organiserData.value.days[date]) {
      organiserData.value.days[date] = {
        date,
        tasks: [],
        notes: '',
      };
    }
    return organiserData.value.days[date];
  };

  // Current day data
  const currentDayData = computed(() => getDayData(currentDate.value));

  // Add a new task
  const addTask = async (
    date: string,
    taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Task> => {
    const now = new Date().toISOString();
    const task: Task = {
      ...taskData,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    };

    const dayData = getDayData(date);
    dayData.tasks.push(task);

    // Also associate task with its group file (if groupId provided)
    try {
      if (task.groupId) {
        const group = organiserData.value.groups.find((g: any) => g.id === task.groupId);
        if (group) {
          // Ensure group has tasks array
          if (!Array.isArray((group as any).tasks)) (group as any).tasks = [];
          (group as any).tasks.push(task);
        } else {
          // If group doesn't exist, create a lightweight group entry so it can be persisted
          const newGroup: any = {
            id: task.groupId,
            name: 'Unknown',
            tasks: [task],
            createdAt: now,
          };
          organiserData.value.groups.push(newGroup);
        }
      }
    } catch (err) {
      console.error('Failed to attach task to group file structure:', err);
    }

    await saveData();
    return task;
  };

  // Update a task
  const updateTask = async (
    date: string,
    taskId: string,
    updates: Partial<Omit<Task, 'id' | 'createdAt'>>,
  ): Promise<void> => {
    const dayData = getDayData(date);
    const task = dayData.tasks.find((t) => t.id === taskId);

    if (!task) {
      throw new Error('Task not found');
    }

    Object.assign(task, updates, {
      updatedAt: new Date().toISOString(),
    });

    await saveData();
  };

  // Delete a task
  const deleteTask = async (date: string, taskId: string): Promise<void> => {
    const dayData = getDayData(date);
    dayData.tasks = dayData.tasks.filter((t) => t.id !== taskId);
    await saveData();
  };

  // Toggle task completion
  const toggleTaskComplete = async (date: string, taskId: string): Promise<void> => {
    const dayData = getDayData(date);
    const task = dayData.tasks.find((t) => t.id === taskId);

    if (task) {
      task.completed = !task.completed;
      task.updatedAt = new Date().toISOString();
      await saveData();
    }
  };

  // Update day notes
  const updateDayNotes = async (date: string, notes: string): Promise<void> => {
    const dayData = getDayData(date);
    dayData.notes = notes;
    await saveData();
  };

  // Get tasks for a date range
  const getTasksInRange = (startDate: string, endDate: string): Task[] => {
    const tasks: Task[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);

    Object.keys(organiserData.value.days).forEach((date) => {
      const current = new Date(date);
      if (current >= start && current <= end) {
        const dayTasks = organiserData.value.days[date]?.tasks;
        if (dayTasks) {
          tasks.push(...dayTasks);
        }
      }
    });

    return tasks.sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      return a.priority.localeCompare(b.priority);
    });
  };

  // Get tasks by category
  const getTasksByCategory = (category: Task['category']): Task[] => {
    const tasks: Task[] = [];
    Object.values(organiserData.value.days).forEach((day) => {
      tasks.push(...day.tasks.filter((t) => t.category === category));
    });
    return tasks;
  };

  // Get tasks by priority
  const getTasksByPriority = (priority: Task['priority']): Task[] => {
    const tasks: Task[] = [];
    Object.values(organiserData.value.days).forEach((day) => {
      tasks.push(...day.tasks.filter((t) => t.priority === priority));
    });
    return tasks;
  };

  // Get incomplete tasks
  const getIncompleteTasks = (): Task[] => {
    const tasks: Task[] = [];
    Object.values(organiserData.value.days).forEach((day) => {
      tasks.push(...day.tasks.filter((t) => !t.completed));
    });
    return tasks.sort((a, b) => a.date.localeCompare(b.date));
  };

  // Export data
  const exportData = () => {
    storage.exportToFile(organiserData.value);
  };

  // Import data
  const importData = async (file: File) => {
    try {
      const data = await storage.importFromFile(file);
      organiserData.value = data;
      await saveData();
    } catch (error) {
      console.error('Failed to import data:', error);
      throw error;
    }
  };

  // Set current date
  const setCurrentDate = (date: string | number | null) => {
    if (date && typeof date === 'string') {
      currentDate.value = date;
    }
  };

  // Navigate to today
  const goToToday = () => {
    currentDate.value = formatDate(new Date());
  };

  // Navigate to next day
  const nextDay = () => {
    const date = new Date(currentDate.value);
    date.setDate(date.getDate() + 1);
    currentDate.value = formatDate(date);
  };

  // Navigate to previous day
  const prevDay = () => {
    const date = new Date(currentDate.value);
    date.setDate(date.getDate() - 1);
    currentDate.value = formatDate(date);
  };

  return {
    // State
    organiserData,
    isLoading,
    currentDate,
    currentDayData,

    // Methods
    loadData,
    saveData,
    getDayData,
    addTask,
    updateTask,
    deleteTask,
    toggleTaskComplete,
    updateDayNotes,
    getTasksInRange,
    getTasksByCategory,
    getTasksByPriority,
    getIncompleteTasks,
    exportData,
    importData,

    // Groups
    groups: computed(() => organiserData.value.groups),
    addGroup,
    updateGroup,
    deleteGroup,
    getGroupsByParent,
    getGroupHierarchy,

    // Navigation
    setCurrentDate,
    goToToday,
    nextDay,
    prevDay,

    // Utils
    formatDate,
  };
}

// Add a new group
const addGroup = async (name: string, parentId?: string, color?: string): Promise<TaskGroup> => {
  const now = new Date().toISOString();
  const group: TaskGroup = {
    id: generateGroupId(name),
    name,
    createdAt: now,
    ...(parentId && { parentId }),
    ...(color && { color }),
  };

  organiserData.value.groups.push(group);
  // Save using storage.ts logic (handles Electron and browser)
  await storage.saveData(organiserData.value);
  return group;
};

// Update a group
const updateGroup = async (
  groupId: string,
  updates: Partial<Omit<TaskGroup, 'id' | 'createdAt'>>,
): Promise<void> => {
  const group = organiserData.value.groups.find((g) => g.id === groupId);
  if (!group) {
    throw new Error('Group not found');
  }
  Object.assign(group, updates);
  await saveData();
};

// Delete a group
const deleteGroup = async (groupId: string): Promise<void> => {
  const groupToDelete = organiserData.value.groups.find((g) => g.id === groupId);

  // Remove group
  organiserData.value.groups = organiserData.value.groups.filter((g) => g.id !== groupId);

  // Remove groupId from all tasks
  Object.values(organiserData.value.days).forEach((day) => {
    day.tasks.forEach((task) => {
      if (task.groupId === groupId) {
        delete task.groupId;
      }
    });
  });

  // Move child groups to parent or root
  organiserData.value.groups.forEach((g) => {
    if (g.parentId === groupId) {
      if (groupToDelete?.parentId) {
        g.parentId = groupToDelete.parentId;
      } else {
        delete g.parentId;
      }
    }
  });

  await saveData();
};

// Get groups by parent (for hierarchical display)
const getGroupsByParent = (parentId?: string): TaskGroup[] => {
  return organiserData.value.groups.filter((g) => g.parentId === parentId);
};

// Get full group hierarchy
const getGroupHierarchy = (): TaskGroup[] => {
  const buildTree = (parentId?: string): TaskGroup[] => {
    return organiserData.value.groups
      .filter((g) => g.parentId === parentId)
      .map((group) => ({
        ...group,
        children: buildTree(group.id),
      })) as TaskGroup[];
  };
  return buildTree();
};

function saveData(): Promise<void> {
  return storage.saveData(organiserData.value);
}
