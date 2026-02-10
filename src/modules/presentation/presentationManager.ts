import { ref } from 'vue';
import { buildFlatTasksList } from 'src/modules/task/managers/taskManager';

export type PresentationMode = 'default' | 'test' | 'presentation';

export function construct() {
  const mode = ref<PresentationMode>('default');
  const active = ref(false);
  const profile = ref<string | null>(null);
  // Do not auto-enable test/presentation mode on startup. Test mode should
  // only be activated explicitly via UI actions (`presentation.start()` or
  // `presentation.toggleTestMode()`), or by a deliberate full reload path.

  function start(presentationProfile?: string) {
    active.value = true;
    mode.value = 'presentation';
    if (presentationProfile) profile.value = presentationProfile;
  }

  function stop() {
    active.value = false;
    mode.value = 'default';
    profile.value = null;
  }

  function toggleTestMode() {
    // For safety: once test mode is enabled it cannot be toggled back
    if (mode.value !== 'test') {
      mode.value = 'test';
      active.value = true;
    }
  }

  async function enableTestModeWithApi(api?: any) {
    try {
      toggleTestMode();
    } catch (e) {
      void e;
    }
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem('co21:testMode', '1');
    } catch (e) {
      void e;
    }

    if (api && api.storage && typeof api.storage.loadData === 'function') {
      try {
        await api.storage.loadData();
        try {
          const days =
            api.task && api.task.time && api.task.time.days ? api.task.time.days.value : {};
          buildFlatTasksList(days);
        } catch (e) {
          void e;
        }
        try {
          window.dispatchEvent(new Event('organiser:reloaded'));
        } catch (e) {
          void e;
        }
      } catch (e) {
        void e;
      }
    }
  }

  async function startPresentationWithApi(api?: any, presentationProfile?: string) {
    try {
      active.value = true;
      mode.value = 'presentation';
      if (presentationProfile) profile.value = presentationProfile;
    } catch (e) {
      void e;
    }
    if (api && api.storage && typeof api.storage.loadData === 'function') {
      try {
        await api.storage.loadData();
        try {
          const days =
            api.task && api.task.time && api.task.time.days ? api.task.time.days.value : {};
          buildFlatTasksList(days);
        } catch (e) {
          void e;
        }
        try {
          window.dispatchEvent(new Event('organiser:reloaded'));
        } catch (e) {
          void e;
        }
      } catch (e) {
        void e;
      }
    }
  }

  async function stopPresentationWithApi(api?: any) {
    try {
      active.value = false;
      mode.value = 'default';
      profile.value = null;
    } catch (e) {
      void e;
    }
    if (api && api.storage && typeof api.storage.loadData === 'function') {
      try {
        await api.storage.loadData();
        try {
          const days =
            api.task && api.task.time && api.task.time.days ? api.task.time.days.value : {};
          buildFlatTasksList(days);
        } catch (e) {
          void e;
        }
        try {
          window.dispatchEvent(new Event('organiser:reloaded'));
        } catch (e) {
          void e;
        }
      } catch (e) {
        void e;
      }
    }
  }

  function setProfile(p: string | null) {
    profile.value = p;
  }

  return {
    mode,
    active,
    profile,
    start,
    stop,
    toggleTestMode,
    enableTestModeWithApi,
    startPresentationWithApi,
    stopPresentationWithApi,
    setProfile,
  } as const;
}

// convenience singleton
export const presentation = construct();
