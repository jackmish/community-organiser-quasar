import { computed } from 'vue';
import type { Ref } from 'vue';
import { hexToRgb, darkenHex, getContrastColor, hexToRgba } from 'src/utils/colorUtils';

/**
 * Composable that derives header/card style computeds from the currently active group's color.
 * Used by DayOrganiserPage.vue.
 *
 * @param groups    - Reactive array of all groups
 * @param activeGroup - Reactive ref of the currently active group { label, value } or null
 */
export function useGroupColor(
  groups: Ref<any[]>,
  activeGroup: Ref<{ label: string; value: string | null } | null>,
) {
  const activeGroupColor = computed<string>(() => {
    try {
      const ag = activeGroup.value;
      const gid = ag && typeof ag === 'object' ? ag.value : ag;
      if (!gid) return '#1976d2';
      const g = groups.value.find((x: any) => String(x.id) === String(gid));
      return (g && g.color) || '#1976d2';
    } catch {
      return '#1976d2';
    }
  });

  const headerStyle = computed(() => ({
    background: activeGroupColor.value,
    color: getContrastColor(activeGroupColor.value),
    padding: '6px 10px',
    borderRadius: '6px',
  }));

  const cardStyle = computed(() => ({
    background: darkenHex(activeGroupColor.value, 0.12),
  }));

  const watermarkTextColor = computed<string>(() => {
    try {
      const ag = activeGroup.value;
      const gid = ag && typeof ag === 'object' ? ag.value : ag;
      let textHex: string = getContrastColor(activeGroupColor.value || '#1976d2');
      if (gid) {
        const g = groups.value.find((x: any) => String(x.id) === String(gid));
        const explicit = g?.textColor ?? g?.text_color ?? null;
        if (explicit) textHex = explicit as string;
      }
      const rgb = hexToRgb(String(textHex));
      if (!rgb) return 'rgba(0,0,0,0.1)';
      return hexToRgba(textHex, 0.7);
    } catch {
      return 'rgba(0,0,0,0.1)';
    }
  });

  return { activeGroupColor, headerStyle, cardStyle, watermarkTextColor } as const;
}
