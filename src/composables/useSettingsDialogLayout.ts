import { computed } from 'vue';
import { useQuasar } from 'quasar';

/** Responsive layout for settings / connection / role dialogs. */
export function useSettingsDialogLayout(desktopMinWidth = 520) {
  const $q = useQuasar();

  const isMobile = computed(() => $q.screen.lt.md);

  const dialogBind = computed(() => ({
    maximized: isMobile.value,
    transitionShow: isMobile.value ? 'slide-up' : 'scale',
    transitionHide: isMobile.value ? 'slide-down' : 'scale',
  }));

  const cardClass = computed(() =>
    isMobile.value
      ? 'column settings-dialog-card settings-dialog-card--mobile'
      : 'column settings-dialog-card',
  );

  const cardStyle = computed(() =>
    isMobile.value
      ? undefined
      : {
          minWidth: `${desktopMinWidth}px`,
          maxWidth: '94vw',
          maxHeight: '92vh',
        },
  );

  /** Scrollable main body inside a flex column card. */
  const bodyClass = 'settings-dialog-body col';

  const bodyStyle = computed(() =>
    isMobile.value
      ? { minHeight: 0, overflow: 'auto' as const }
      : { minHeight: 0, overflow: 'auto' as const, maxHeight: 'calc(92vh - 120px)' },
  );

  return { isMobile, dialogBind, cardClass, cardStyle, bodyClass, bodyStyle };
}
