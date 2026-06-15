import { computed, ref, type Ref } from 'vue';
import { normalizeAppViewMode, type AppViewMode } from '../mediaMode';
import {
  loadMediaViewModeMap,
  saveMediaViewModeForGroup,
  type MediaViewModeByGroup,
} from '../mediaSettings';

const modeByGroup = ref<MediaViewModeByGroup>({});
const loaded = ref(false);

export function useAppViewMode(
  activeGroup: Ref<{ id?: string; mediaEnabled?: boolean | undefined } | null | undefined>,
) {
  const groupId = computed(() => {
    const id = activeGroup.value?.id;
    return id != null ? String(id).trim() : '';
  });

  const filesModuleEnabled = computed(() => !!activeGroup.value?.mediaEnabled);

  const storedMode = computed((): AppViewMode => {
    const id = groupId.value;
    if (!id) return 'calendar';
    return normalizeAppViewMode(modeByGroup.value[id]);
  });

  const isFilesMode = computed(() => storedMode.value === 'files');
  const isNotesMode = computed(() => storedMode.value === 'notes');
  const isCalendarMode = computed(() => storedMode.value === 'calendar');
  /** Files or notes — calendar row and date nav are hidden. */
  const isAlternateListMode = computed(() => isFilesMode.value || isNotesMode.value);

  async function refreshModes(): Promise<void> {
    modeByGroup.value = await loadMediaViewModeMap();
    loaded.value = true;
  }

  async function setViewMode(mode: AppViewMode): Promise<void> {
    const id = groupId.value;
    if (!id) return;
    const next = normalizeAppViewMode(mode);
    modeByGroup.value = { ...modeByGroup.value, [id]: next };
    await saveMediaViewModeForGroup(id, next);
  }

  async function toggleViewMode(): Promise<void> {
    await toggleFilesMode();
  }

  async function toggleFilesMode(): Promise<void> {
    await setViewMode(isFilesMode.value ? 'calendar' : 'files');
  }

  async function toggleNotesMode(): Promise<void> {
    await setViewMode(isNotesMode.value ? 'calendar' : 'notes');
  }

  function onExternalChange(ev: Event): void {
    const detail = (ev as CustomEvent<MediaViewModeByGroup>).detail;
    if (detail && typeof detail === 'object') {
      modeByGroup.value = { ...detail };
    }
  }

  return {
    loaded,
    filesModuleEnabled,
    /** @deprecated Use filesModuleEnabled */
    mediaEnabled: filesModuleEnabled,
    storedMode,
    isFilesMode,
    /** @deprecated Use isFilesMode */
    isMediaMode: isFilesMode,
    isNotesMode,
    isCalendarMode,
    isAlternateListMode,
    refreshModes,
    setViewMode,
    toggleViewMode,
    toggleFilesMode,
    toggleNotesMode,
    onExternalChange,
  };
}
