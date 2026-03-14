/**
 * useReplenishDropdown
 *
 * Extracts all replenish-search/autocomplete logic from AddTaskForm.vue so it
 * can be unit-tested in isolation (pure-logic parts) and reused if needed.
 *
 * Manages:
 *  - replenishQuery, selectedReplenishId, showReplenishList, replenishListStyle
 *  - replenishMatches / smallReplenishTasks computeds
 *  - replenishAlreadyAdded() helper
 *  - selectReplenishMatch() / createReplenishFromInput() actions
 *  - positionReplenishList() + resize/scroll listeners (onMounted/onBeforeUnmount)
 *  - onReplenishInput() / onReplenishFocus() event handlers
 *  - auto-capitalize watch on replenishQuery
 *  - replenishInput DOM ref (returned so template can bind via ref="replenishInput")
 */

import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { Ref } from 'vue';
import logger from 'src/utils/logger';

// Minimal task shape required by this composable
export interface ReplenishTask {
  name: string;
  type_id: string;
  status_id: number | string;
  description?: string;
  id?: string;
  eventDate?: string;
  groupId?: string | undefined;
  [key: string]: unknown;
}

export interface UseReplenishDropdownOptions {
  /** The reactive task object being edited/created. */
  localNewTask: Ref<ReplenishTask>;
  /** All tasks in the current day/view. */
  allTasks: Ref<any[]>;
  /** Pre-filtered replenish tasks provided by the parent (may be empty). */
  replenishTasks: Ref<any[]>;
  /** The currently selected date string (YYYY-MM-DD). */
  selectedDate: Ref<string>;
  /** Whether the form should stay open after saving. */
  stayAfterSave: Ref<boolean>;
  /** Vue emit function from the host component. */
  emit: (event: string, ...args: any[]) => void;
  /** API call to update an existing task. */
  updateTask: (date: string, id: string, updates: Record<string, unknown>) => Promise<void>;
}

export function useReplenishDropdown({
  localNewTask,
  allTasks,
  replenishTasks,
  selectedDate,
  stayAfterSave,
  emit,
  updateTask,
}: UseReplenishDropdownOptions) {
  // ─── State ──────────────────────────────────────────────────────────────────

  const replenishQuery = ref('');
  const selectedReplenishId = ref<string | null>(null);
  const showReplenishList = ref(false);
  const replenishListStyle = ref<Record<string, string>>({ display: 'none' });

  // DOM reference returned so the template can bind it: ref="replenishInput"
  const replenishInput = ref<any>(null);

  // ─── Computeds ──────────────────────────────────────────────────────────────

  /** Tasks matching the current replenish query (all Replenish tasks when query is empty). */
  const replenishMatches = computed<any[]>(() => {
    const q = (replenishQuery.value ?? '').toLowerCase().trim();
    const all: any[] = allTasks.value ?? [];
    const replenish = all.filter((t: any) => t.type_id === 'Replenish');
    if (!q) return replenish;
    return replenish.filter((t: any) => (t.name ?? '').toLowerCase().includes(q));
  });

  /** The effective replenish task list to display in the mini-list widget. */
  const smallReplenishTasks = computed<any[]>(() => {
    const rt = replenishTasks.value;
    if (rt && Array.isArray(rt) && rt.length > 0) return rt;
    return (allTasks.value ?? []).filter((t: any) => (t.type_id || t.type) === 'Replenish');
  });

  // ─── Pure helpers ────────────────────────────────────────────────────────────

  /** Returns true when `m` is already present for the currently selected date. */
  function replenishAlreadyAdded(m: any): boolean {
    try {
      const name = m?.name ? String(m.name).trim().toLowerCase() : '';
      if (!name) return false;
      const sel = String(selectedDate.value ?? '').trim();
      return (allTasks.value ?? []).some((t: any) => {
        if ((t.type_id || t.type) !== 'Replenish') return false;
        if (t.id && m.id && String(t.id) === String(m.id)) return true;
        const tn = (t.name ?? '').trim().toLowerCase();
        if (tn !== name) return false;
        const taskDate = t.date || t.eventDate || '';
        return sel ? String(taskDate) === sel : true;
      });
    } catch {
      return false;
    }
  }

  // ─── Actions ─────────────────────────────────────────────────────────────────

  /** Restores a replenish task to "undone" (status_id=1) and closes the dropdown. */
  async function selectReplenishMatch(t: any): Promise<void> {
    selectedReplenishId.value = t.id;
    replenishQuery.value = t.name ?? '';
    try {
      const targetDate =
        t.date ?? t.eventDate ?? selectedDate.value ?? localNewTask.value.eventDate ?? '';
      await updateTask(targetDate, t.id, { status_id: 1 });
      emit('cancel-edit');
    } catch (e) {
      logger.error('Failed to restore replenish task', e);
    }
    selectedReplenishId.value = null;
    replenishQuery.value = '';
    showReplenishList.value = false;
  }

  /** Pointer-event wrapper (prevents double-fire on mobile). */
  function handleReplItemPointer(t: any): void {
    void selectReplenishMatch(t);
  }

  /** Creates a new Replenish task from the current query text. */
  function createReplenishFromInput(): void {
    const name = (replenishQuery.value ?? '').trim();
    if (!name) return;
    localNewTask.value.name = name;
    localNewTask.value.type_id = 'Replenish';
    localNewTask.value.status_id = 1;
    emit('add-task', { ...localNewTask.value }, { preview: !stayAfterSave.value });
    replenishQuery.value = '';
    selectedReplenishId.value = null;
    localNewTask.value.description = '';
    showReplenishList.value = false;
  }

  // ─── Dropdown positioning ────────────────────────────────────────────────────

  function positionReplenishList(): void {
    try {
      const inputEl: Element | null = replenishInput.value?.$el ?? replenishInput.value ?? null;
      const input: Element | null = inputEl?.querySelector
        ? inputEl.querySelector('input')
        : inputEl;
      if (!input) {
        replenishListStyle.value = { display: 'none' };
        return;
      }
      const rect = (input as HTMLElement).getBoundingClientRect();
      const left = rect.left + (window.scrollX || window.pageXOffset || 0);
      const top = rect.bottom + (window.scrollY || window.pageYOffset || 0) + 6;
      const width = rect.width || (input as HTMLElement).offsetWidth || 280;
      replenishListStyle.value = {
        position: 'fixed',
        left: `${left}px`,
        top: `${top}px`,
        width: `${width}px`,
        background: '#fff',
        borderRadius: '8px',
        boxShadow: '0 6px 18px rgba(0,0,0,0.12)',
        padding: '8px',
        zIndex: '4000',
        maxHeight: '260px',
        overflow: 'auto',
        display: 'block',
      };
    } catch {
      replenishListStyle.value = { display: 'none' };
    }
  }

  // ─── Input / focus handlers ───────────────────────────────────────────────────

  function onReplenishInput(val: string | number | null): void {
    const s = val == null ? '' : String(val);
    showReplenishList.value = !!(s && s.trim());
    if (showReplenishList.value) {
      void nextTick(positionReplenishList);
    } else {
      replenishListStyle.value = { display: 'none' };
    }
  }

  function onReplenishFocus(): void {
    if (replenishQuery.value && replenishQuery.value.trim()) {
      showReplenishList.value = true;
      void nextTick(positionReplenishList);
    } else {
      showReplenishList.value = false;
    }
  }

  // ─── Watchers ─────────────────────────────────────────────────────────────────

  // Auto-capitalize first letter typed into the search box
  watch(replenishQuery, (val) => {
    if (typeof val !== 'string' || !val) return;
    const corrected = val.charAt(0).toUpperCase() + val.slice(1);
    if (corrected !== val) replenishQuery.value = corrected;
  });

  // ─── Lifecycle ────────────────────────────────────────────────────────────────

  onMounted(() => {
    window.addEventListener('resize', positionReplenishList);
    window.addEventListener('scroll', positionReplenishList, true);
  });

  onBeforeUnmount(() => {
    window.removeEventListener('resize', positionReplenishList);
    window.removeEventListener('scroll', positionReplenishList, true);
  });

  return {
    // DOM ref (bind with ref="replenishInput" in template)
    replenishInput,
    // state
    replenishQuery,
    selectedReplenishId,
    showReplenishList,
    replenishListStyle,
    // computeds
    replenishMatches,
    smallReplenishTasks,
    // helpers
    replenishAlreadyAdded,
    // actions
    selectReplenishMatch,
    handleReplItemPointer,
    createReplenishFromInput,
    // handlers
    onReplenishInput,
    onReplenishFocus,
    positionReplenishList,
  };
}
