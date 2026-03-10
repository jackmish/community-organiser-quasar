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
          style="
            display: flex;
            align-items: center;
            justify-content: space-between;
            width: 100%;
          "
          @click.stop.prevent="menuOpen = !menuOpen"
        >
          <div style="display: flex; align-items: center; gap: 8px">
            <q-icon
              :name="selectedOption?.icon || 'folder_open'"
              :style="{ color: selectedOption?.color || 'inherit' }"
            />
            <span
              style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis"
              >{{ selectedOption?.label }}</span
            >
          </div>
          <q-icon name="arrow_drop_down" />
        </q-btn>

        <q-menu v-model="menuOpen" anchor="bottom left" self="top left" :offset="[0, 6]">
          <div style="min-width: 260px; max-height: 60vh; overflow: auto; padding: 8px">
            <q-list padding>
              <q-item clickable v-ripple @click="onSelectAll">
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
                    <q-space />
                    <q-btn
                      v-if="isNodeShortcut(prop.node)"
                      flat
                      dense
                      style="
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        text-transform: none;
                      "
                      class="q-ml-sm"
                      @click.stop.prevent="activateTreeShortcut(prop.node)"
                    >
                      <q-icon
                        :name="prop.node.icon || 'folder'"
                        :style="{ color: prop.node.color }"
                      />
                      <span
                        style="
                          max-width: 120px;
                          overflow: hidden;
                          text-overflow: ellipsis;
                          white-space: nowrap;
                        "
                        >{{ prop.node.label }}</span
                      >
                      <q-tooltip>Shortcut</q-tooltip>
                    </q-btn>
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
        @click.stop.prevent="api.group.active.goToParent"
      >
        <q-tooltip v-if="parentName">Go to parent: {{ parentName }}</q-tooltip>
      </q-btn>
      <div
        v-if="shortcutGroups && shortcutGroups.length"
        style="display: flex; gap: 8px; align-items: center"
      >
        <q-btn
          v-for="g in shortcutGroups"
          :key="g.id"
          dense
          rounded
          unelevated
          class="shortcut-header"
          :class="{ selected: isShortcutActive(g) }"
          :aria-disabled="isShortcutActive(g)"
          :tabindex="isShortcutActive(g) ? -1 : 0"
          :title="`Go to ${g.name}`"
          @click.stop.prevent="onShortcutClick(g)"
          :style="`background-color: ${g.color || 'transparent'} !important; color: ${
            g.textColor || g.text_color || (g.color ? '#ffffff' : 'inherit')
          }; border:1px solid ${
            g.textColor
          }; padding: 4px 8px; min-height: 28px; display: inline-flex; align-items: center; gap: 8px; background-image: none !important;  box-shadow: none !important;`"
        >
          <q-icon
            :name="g.icon || 'folder_open'"
            :style="{
              color:
                g.textColor ||
                g.text_color ||
                (g.color ? '#ffffff' : g.color || 'inherit'),
            }"
          />
          <span
            style="
              max-width: 140px;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            "
            >{{ g.name }}</span
          >
        </q-btn>
      </div>
    </template>
    <template v-else>
      <div style="min-width: 220px; height: 38px; display: flex; align-items: center">
        <q-skeleton type="rect" style="width: 100%; height: 100%" />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import * as api from "src/modules/day-organiser/_apiRoot";

const groups = api.group.list.all;
const activeGroup = api.group.active.activeGroup;
const parentGroup = api.group.active.parent;
const isLoading = api.storage.isLoading;

// Normalize parent id values: accept string/number or object like { value, id }
const normalizeId = (v: any): string | null => {
  if (v == null) return null;
  if (typeof v === "object") {
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
  { immediate: true }
);

// assemble flat list of options from groups list (shorter)
const options = computed(() => {
  const manage = { label: "Manage Groups...", value: "__manage_groups__" };

  const base: any[] = [
    { label: "All Groups", value: null, icon: "folder_open", color: null },
  ];

  const groupOptions = (groups.value || [])
    .slice()
    .sort((a: any, b: any) => String(a.name).localeCompare(String(b.name)))
    .map((g: any) => ({
      label: g.name,
      value: String(g.id),
      icon: g.icon || "folder",
      color: g.color || null,
    }));

  const combined = base.concat(groupOptions);

  // Ensure activeGroup is present in the options
  const cur = activeGroup.value;
  if (cur) {
    const curVal =
      typeof cur === "string" || typeof cur === "number"
        ? String(cur)
        : String((cur && (cur.value ?? cur.id)) ?? "");
    if (curVal && !combined.some((o: any) => o.value === curVal)) {
      const found = (groups.value || []).find((g: any) => String(g.id) === curVal);
      const label =
        (typeof cur === "object" && cur.label) || (found && found.name) || curVal;
      combined.push({
        label,
        value: curVal,
        icon: found?.icon || "folder",
        color: found?.color || null,
      });
    }
  }

  return combined.concat(manage);
});

function extractIdFrom(obj: unknown): string | null {
  return normalizeId(obj as any);
}

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

//converting api tree into q-tree
const convertNode = (n: any): any => ({
  id: String(n.id),
  label: n.label,
  icon: n.icon || "folder",
  color: n.color || null,
  children: (n.children || []).map(convertNode),
});

const treeNodes = computed(() => {
  try {
    return (api.group.list.tree.value || []).map(convertNode);
  } catch (e) {
    return [];
  }
});

const selectedKeyArray = computed(() =>
  localValue.value ? [String(localValue.value)] : []
);

// keep localValue in sync with shared activeGroup
watch(
  activeGroup,
  (v) => {
    if (!v) {
      localValue.value = null;
      prevValue = null;
      return;
    }
    const val =
      typeof v === "string" || typeof v === "number"
        ? String(v)
        : String(extractIdFrom(v) ?? "");
    localValue.value = val || null;
    prevValue = val || null;
  },
  { immediate: true }
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
    const ag = activeGroup.value;
    const gid =
      typeof ag === "string" || typeof ag === "number"
        ? String(ag)
        : String(extractIdFrom(ag) ?? "");
    if (!gid) return;
    const found = (list || []).find((g: any) => String(g.id) === gid);
    if (found) {
      const agObj = typeof ag === "object" && ag ? (ag as Record<string, any>) : null;
      const agLabel = agObj ? (agObj.label as string | undefined) : undefined;
      const agValue = agObj ? (agObj.value as string | undefined) : undefined;
      if (agLabel !== found.name || String(agValue ?? "") !== gid)
        activeGroup.value = { label: found.name, value: gid };
      if (localValue.value !== gid) localValue.value = gid;
    }
  },
  { immediate: true }
);

function onSelectAll() {
  // delegate the canonical selection change to the shared API
  api.group.active.selectAll();
  // keep local UI state in sync
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
  window.dispatchEvent(new Event("group:manage-request"));
  menuOpen.value = false;
}

const parentButtonVisible = computed(() => Boolean(parentGroup.value));
const parentName = computed(() => (parentGroup.value ? parentGroup.value.name : null));

const selectedGroupObj = computed(() => {
  try {
    const gid = localValue.value;
    if (!gid) return null;
    return (groups.value || []).find((g: any) => String(g.id) === String(gid)) || null;
  } catch (e) {
    return null;
  }
});

const shortcutGroups = computed(() => {
  try {
    return (groups.value || []).filter((g: any) => g && g.shortcut) || [];
  } catch (e) {
    return [];
  }
});

const filteredShortcutGroups = computed(() => {
  try {
    return (shortcutGroups.value || []).filter(
      (g: any) => String(g.id) !== String(localValue.value ?? "")
    );
  } catch (e) {
    return [];
  }
});

function activateGroup(g: any) {
  try {
    if (!g) return;
    api.group.active.activeGroup.value = {
      label: g.name || String(g.id),
      value: String(g.id),
    };
  } catch (e) {
    void e;
  }
}

function activateTreeShortcut(node: any) {
  try {
    const grp =
      node && node.group
        ? node.group
        : (groups.value || []).find((gg: any) => String(gg.id) === String(node.id));
    if (grp) activateGroup(grp);
  } catch (e) {
    void e;
  }
}

function isNodeShortcut(node: any) {
  try {
    if (!node) return false;
    const gid = String(node.id ?? node.value ?? "");
    if (!gid) return false;
    const grp = (groups.value || []).find((g: any) => String(g.id) === gid);
    if (!grp) return false;
    return Boolean(grp.shortcut) && String(gid) !== String(localValue.value ?? "");
  } catch (e) {
    return false;
  }
}

function isShortcutActive(g: any) {
  try {
    if (!g) return false;
    const gid = String(g.id ?? g.value ?? "");
    const cur =
      localValue.value ?? activeGroup?.value?.value ?? activeGroup?.value ?? null;
    return gid && String(gid) === String(cur ?? "");
  } catch (e) {
    return false;
  }
}

function onShortcutClick(g: any) {
  try {
    if (isShortcutActive(g)) return; // do nothing for active shortcut
    activateGroup(g);
  } catch (e) {
    void e;
  }
}
</script>

<style scoped>
.shortcut-header {
  border-radius: 6px;
  padding: 2px 6px !important;
  font-size: 0.88rem;
  min-height: 28px;
  display: inline-flex;
  align-items: center;
}

/* Disabled visual state for shortcuts (when the shortcut matches the active group)
   Use a selected-like appearance rather than muting the item. Clicks are still
   ignored by the handler when this state applies. */
.shortcut-header.selected {
  /* Selected-like appearance for the active shortcut. Non-interactive. */
  opacity: 1;
  filter: none;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);

  outline-offset: 2px;
  outline: 2px dashed rgb(255, 255, 255) !important;
  pointer-events: none;
  cursor: default;
}
</style>
