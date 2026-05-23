import { computed, type StyleValue } from 'vue';
import { useQuasar } from 'quasar';

export type SettingsDialogLayoutOptions = {
  /** Minimum card width on desktop (px). */
  minWidth?: number;
  /** Maximum card width on desktop (px). Defaults to minWidth. */
  maxWidth?: number;
};

/** Responsive layout for settings, connection, group, and role dialogs. */
export function useSettingsDialogLayout(
  desktopMinWidth = 520,
  desktopMaxWidthOrOptions?: number | SettingsDialogLayoutOptions,
) {
  const $q = useQuasar();

  const opts: SettingsDialogLayoutOptions =
    typeof desktopMaxWidthOrOptions === 'number'
      ? { minWidth: desktopMinWidth, maxWidth: desktopMaxWidthOrOptions }
      : { minWidth: desktopMinWidth, ...desktopMaxWidthOrOptions };

  const minWidth = opts.minWidth ?? 520;
  const maxWidth = opts.maxWidth ?? minWidth;

  /** Phones only — not tablet / narrow desktop (Quasar md = 1024px was too aggressive). */
  const isMobile = computed(() => $q.screen.lt.sm);

  const dialogBind = computed(() => ({
    maximized: isMobile.value,
    transitionShow: isMobile.value ? 'slide-up' : 'scale',
    transitionHide: isMobile.value ? 'slide-down' : 'scale',
  }));

  const cardClass = computed(() =>
    isMobile.value
      ? 'column co21-dialog-card settings-dialog-card settings-dialog-card--mobile'
      : 'column co21-dialog-card settings-dialog-card',
  );

  const cardStyle = computed((): StyleValue | undefined => {
    if (isMobile.value) return undefined;
    return {
      '--co21-dialog-min': `${minWidth}px`,
      '--co21-dialog-max': `${maxWidth}px`,
      width: 'auto',
      minWidth: `min(${minWidth}px, 94vw)`,
      maxWidth: `min(${maxWidth}px, 94vw)`,
      maxHeight: '92vh',
    };
  });

  /** Title block: full width, does not share a row with the body. */
  const headerClass = 'settings-dialog-header';

  /** Scrollable main body inside a flex column card. */
  const bodyClass = 'settings-dialog-body';

  const bodyStyle = computed((): StyleValue => ({
    minHeight: 0,
    overflow: 'auto',
    ...(isMobile.value ? {} : { maxHeight: 'calc(92vh - 120px)' }),
  }));

  return {
    isMobile,
    dialogBind,
    cardClass,
    cardStyle,
    headerClass,
    bodyClass,
    bodyStyle,
  };
}
