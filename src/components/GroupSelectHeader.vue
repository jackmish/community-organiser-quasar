<template>
  <div style="display: flex; align-items: center; gap: 8px">
    <template v-if="optionsReady">
      <div style="min-width: 220px">
        <q-btn
          unelevated
          dense
          outline
          class="group-select--header"
          color="white"
          text-color="white"
          style="display: flex; align-items: center; justify-content: space-between; width: 100%"
          @click.stop.prevent="menuOpen = !menuOpen"
        >
          <div style="display: flex; align-items: center; gap: 8px">
            <q-icon
              :name="selectedOption?.icon || 'folder_open'"
              :style="{ color: selectedOption?.color || 'inherit' }"
            />
            <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{{
              selectedOption?.label
            }}</span>
          </div>
          <q-icon name="arrow_drop_down" />
        </q-btn>

        <q-menu v-model="menuOpen" anchor="bottom left" self="top left" :offset="[0, 6]">
          <div style="min-width: 260px; max-height: 60vh; overflow: auto; padding: 8px">
            <q-list padding>
              <q-item clickable v-ripple @click="selectAll">
                <q-item-section avatar style="min-width: 36px">
                  <q-icon name="folder_open" />
                </q-item-section>
                <q-item-section>All Groups</q-item-section>
              </q-item>
            </q-list>

            <q-separator />

            <div style="max-height: 48vh; overflow: auto; padding-top: 6px">
              <q-tree
                :nodes="treeNodes"
                node-key="id"
                default-expand-all
                :selected="selectedKeyArray"
                @update:selected="onTreeSelect"
              >
                <template #default-header="prop">
                  <div class="row items-center full-width">
                    <q-icon
                      :name="prop.node.icon || 'folder'"
                      class="q-mr-sm"
                      :style="{ color: prop.node.color }"
                    />
                    <span>{{ prop.node.label }}</span>
                  </div>
                </template>
              </q-tree>
            </div>

            <q-separator />

            <q-list padding>
              <q-item clickable v-ripple @click="openManage">
                <q-item-section>Manage Groups...</q-item-section>
              </q-item>
            </q-list>
          </div>
        </q-menu>
      </div>
      <q-btn
        v-if="parentButtonVisible"
        flat
        dense
        round
        icon="arrow_upward"
        title="Go to parent group"
        @click.stop.prevent="goToParent"
      >
        <q-tooltip v-if="parentName">Go to parent: {{ parentName }}</q-tooltip>
      </q-btn>
    </template>
    <template v-else>
      <div style="min-width: 220px; height: 38px; display: flex; align-items: center">
        <q-skeleton type="rect" style="width: 100%; height: 100%" />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import logger from 'src/utils/logger';
import { useDayOrganiser } from 'src/modules/day-organiser';

const { groups, activeGroup, isLoading } = useDayOrganiser();

// Normalize parent id values: accept string/number or object like { value, id }
const normalizeId = (v: any): string | null => {
  if (v == null) return null;
  if (typeof v === 'object') {
    const maybe = v.value ?? v.id ?? null;
    return maybe == null ? null : String(maybe);
  }
  return String(v);
};

const localValue = ref<string | null>(null);
let prevValue: string | null = null;
const menuOpen = ref(false);

// expose options once loading finishes
const optionsReady = ref(false);
watch(
  () => isLoading && isLoading.value,
  (loading) => {
    if (loading === false) optionsReady.value = true;
  },
  { immediate: true },
);

const options = computed(() => {
  const manage = { label: 'Manage Groups...', value: '__manage_groups__' };

  // Build a parent->children map (support both camelCase and snake_case parent fields)
  const byParent: Record<string, any[]> = {};
  (groups.value || []).forEach((g: any) => {
    const pid = normalizeId(g.parentId ?? g.parent_id ?? null);
    const key = pid != null ? String(pid) : '__root__';
    if (!byParent[key]) byParent[key] = [];
    byParent[key].push(g);
  });

  const flat: any[] = [];
  const walk = (parentKey: string, depth = 0) => {
    const list = byParent[parentKey] || [];
    // sort by name for stable order
    list.sort((a, b) => String(a.name).localeCompare(String(b.name)));
    list.forEach((g: any) => {
      flat.push({
        label: `${'\u00A0'.repeat(depth * 2)}${g.name}`,
        value: String(g.id),
        icon: g.icon || 'folder',
        color: g.color || null,
      });
      walk(String(g.id), depth + 1);
    });
  };

  walk('__root__', 0);

  const base: any[] = [{ label: 'All Groups', value: null, icon: 'folder_open', color: null }];
  const combined = base.concat(flat);

  // Ensure activeGroup is present
  const cur = activeGroup.value;
  if (cur) {
    const curAny = cur as any;
    const curVal = String(curAny.value ?? curAny.id ?? '');
    if (curVal && !combined.some((o: any) => o.value === curVal)) {
      const found = (groups.value || []).find((g: any) => String(g.id) === curVal);
      const label = cur.label || (found && found.name) || curVal;
      combined.push({
        label,
        value: curVal,
        icon: found?.icon || 'folder',
        color: found?.color || null,
      });
    }
  }

  return combined.concat(manage);
});

const selectedOption = computed(() => {
  try {
    if (!options.value) return null;
    if (!localValue.value) return options.value[0] || null;
    return (
      options.value.find((o: any) => String(o.value) === String(localValue.value)) ||
      options.value[0]
    );
  } catch (e) {
    return null;
  }
});

const selectKey = computed(
  () =>
    `gsel-${optionsReady.value ? 'r' : 'w'}-${(options.value || []).length}-${localValue.value ?? 'nil'}`,
);

const treeNodes = computed(() => {
  // build nested nodes for q-tree
  const byParent: Record<string, any[]> = {};
  (groups.value || []).forEach((g: any) => {
    const pid = normalizeId(g.parentId ?? g.parent_id ?? null);
    const key = pid != null ? String(pid) : '__root__';
    if (!byParent[key]) byParent[key] = [];
    byParent[key].push(g);
  });

  const build = (parentKey: string): Array<any> => {
    const list = (byParent[parentKey] || [])
      .slice()
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));
    return list.map((g: any) => ({
      id: String(g.id),
      label: g.name,
      icon: g.icon || 'folder',
      color: g.color || null,
      children: build(String(g.id)),
    }));
  };

  return build('__root__');
});

const selectedKeyArray = computed(() => (localValue.value ? [String(localValue.value)] : []));

// keep localValue in sync with shared activeGroup
watch(
  activeGroup,
  (v) => {
    if (!v) {
      localValue.value = null;
      prevValue = null;
      return;
    }
    const anyV = v as any;
    const val =
      typeof anyV === 'string' || typeof anyV === 'number'
        ? String(anyV)
        : String(anyV?.value ?? anyV?.id ?? '');
    localValue.value = val || null;
    prevValue = val || null;
  },
  { immediate: true },
);

// ensure activeGroup is set to a sensible default when groups load
watch(
  groups,
  (list) => {
    if (!list || list.length === 0) return;
    if (!activeGroup.value) {
      const fg = list[0];
      if (!fg) return;
      activeGroup.value = { label: fg.name || String(fg.id), value: String(fg.id) };
      localValue.value = String(fg.id);
      prevValue = String(fg.id);
      return;
    }
    // sync label/value with group record if possible
    const agAny = activeGroup.value as any;
    const gid =
      typeof agAny === 'string' || typeof agAny === 'number'
        ? String(agAny)
        : String(agAny?.value ?? agAny?.id ?? '');
    if (!gid) return;
    const found = (list || []).find((g: any) => String(g.id) === gid);
    if (found) {
      if (agAny.label !== found.name || agAny.value !== gid)
        activeGroup.value = { label: found.name, value: gid };
      if (localValue.value !== gid) localValue.value = gid;
    }
  },
  { immediate: true },
);

const onChange = (val: any) => {
  if (val === '__manage_groups__') {
    window.dispatchEvent(new Event('group:manage-request'));
    localValue.value = prevValue;
    return;
  }
  const opt = options.value.find((o: any) => o.value === val);
  if (opt) activeGroup.value = { label: opt.label, value: opt.value };
  else activeGroup.value = null;
  prevValue = val ?? null;
};

function selectAll() {
  activeGroup.value = null;
  localValue.value = null;
  menuOpen.value = false;
  prevValue = null;
}

function onTreeSelect(val: any) {
  try {
    // val can be a single key or array depending on q-tree; prefer first
    const key = Array.isArray(val) ? val[0] : val;
    if (!key) return;
    // if special keys used, handle them (none here)
    localValue.value = String(key);
    const found = options.value.find((o: any) => String(o.value) === String(key));
    if (found) activeGroup.value = { label: found.label, value: found.value };
    else activeGroup.value = { label: String(key), value: String(key) };
  } finally {
    menuOpen.value = false;
  }
}

function openManage() {
  window.dispatchEvent(new Event('group:manage-request'));
  menuOpen.value = false;
}

const parentGroup = computed(() => {
  try {
    const cur = activeGroup.value as any;
    const gid = cur ? String(cur.value ?? cur.id ?? cur) : null;
    if (!gid) return null;
    const g = (groups.value || []).find((gg: any) => String(gg.id) === String(gid));
    if (!g) return null;
    const pid = normalizeId(g.parentId ?? g.parent_id ?? null);
    if (!pid) return null;
    return (groups.value || []).find((gg: any) => String(gg.id) === String(pid)) || null;
  } catch (e) {
    return null;
  }
});

const parentButtonVisible = computed(() => Boolean(parentGroup.value));
const parentName = computed(() => (parentGroup.value ? parentGroup.value.name : null));

function goToParent() {
  const p = parentGroup.value;
  if (!p) return;
  activeGroup.value = { label: p.name || String(p.id), value: p.id };
}

watch(
  () => menuOpen.value,
  (v) => {
    try {
      logger.debug(
        '[GroupSelectHeader] menuOpen=',
        v,
        'treeNodes.len=',
        (treeNodes.value || []).length,
      );
    } catch (e) {
      // ignore
    }
  },
);
</script>

<style scoped></style>
