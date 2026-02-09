import { ref } from 'vue';

export type PresentationMode = 'default' | 'test' | 'presentation';

export function construct() {
  const mode = ref<PresentationMode>('default');
  const active = ref(false);
  const profile = ref<string | null>(null);

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
    mode.value = mode.value === 'test' ? 'default' : 'test';
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
    setProfile,
  } as const;
}

// convenience singleton
export const presentation = construct();
