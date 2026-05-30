import { ref, watch, type Ref } from 'vue';
import {
  groupBackgroundLayerBundle,
  readGroupBackgroundFields,
  resolveGroupBackground,
  type GroupBackgroundLayerBundle,
  type GroupBackgroundState,
} from 'src/modules/group/utils/groupBackground';
import { resolveGroupBackgroundDisplayUrl } from 'src/modules/group/utils/groupBackgroundStorage';

type ActiveGroupRef = { value?: string | null };

function isActiveGroupRef(active: object): active is ActiveGroupRef {
  return 'value' in active;
}

function activeGroupId(active: unknown): string | null {
  if (active == null) return null;
  if (typeof active === 'string' || typeof active === 'number') {
    return String(active);
  }
  if (typeof active === 'object' && isActiveGroupRef(active)) {
    const v = active.value;
    return v == null ? null : String(v);
  }
  return null;
}

function findGroupById(groups: unknown[], id: string | null): Record<string, unknown> | null {
  if (!id) return null;
  const g = (groups || []).find((x: any) => String(x?.id) === String(id));
  return g && typeof g === 'object' ? (g as Record<string, unknown>) : null;
}

function stateKey(state: GroupBackgroundState): string {
  return JSON.stringify({
    url: state.imageUrl,
    color: state.color,
    colorize: state.colorize,
    fallback: state.fallbackImageUrl,
  });
}

const emptyBundle: GroupBackgroundLayerBundle = { photo: {}, wash: null };

/**
 * Drives {@link Co21AppBackground} with cross-fade when the active group (or its image) changes.
 */
export function useGroupPageBackground(
  groups: Ref<unknown[]>,
  activeGroup: Ref<unknown>,
) {
  const bootState = resolveGroupBackground(null);
  let lastKey = stateKey(bootState);

  const bootBundle = groupBackgroundLayerBundle(bootState);

  const visibleSlot = ref<0 | 1>(0);
  const layer0 = ref<GroupBackgroundLayerBundle>(bootBundle);
  const layer1 = ref<GroupBackgroundLayerBundle>(emptyBundle);

  function applyState(state: GroupBackgroundState) {
    const bundle = groupBackgroundLayerBundle(state);
    const key = stateKey(state);
    if (key === lastKey) return;
    lastKey = key;

    const next: 0 | 1 = visibleSlot.value === 0 ? 1 : 0;
    if (next === 0) layer0.value = bundle;
    else layer1.value = bundle;
    visibleSlot.value = next;
  }

  async function sync() {
    const gid = activeGroupId(activeGroup.value);
    const group = findGroupById(groups.value, gid);
    const fields = readGroupBackgroundFields(group);
    const displayUrl = await resolveGroupBackgroundDisplayUrl(fields.backgroundImage);
    applyState(
      resolveGroupBackground(
        group
          ? {
              ...group,
              backgroundImage: displayUrl,
            }
          : null,
      ),
    );
  }

  watch([groups, activeGroup], () => void sync(), { deep: true, immediate: true });

  return { visibleSlot, layer0, layer1, sync };
}
