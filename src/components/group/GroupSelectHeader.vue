<template>
  <div style="display: flex; align-items: center; gap: 8px">
    <template v-if="optionsReady">
      <div style="min-width: 220px">
        <q-btn
          unelevated
          dense
          outline
          class="group-select--header"
          @click.stop.prevent="menuOpen = !menuOpen"
          :style="{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            color: getBtnTextColor(selectedOption) || 'inherit',
            border: '1px solid ' + (getBtnBorderColor(selectedOption) || 'transparent'),
            boxShadow: 'none !important',
          }"
        >
          <div style="display: flex; align-items: center; gap: 8px; flex: 1">
            <q-icon
              :name="selectedOption?.icon || 'folder_open'"
              :style="
                'color: ' +
                (getBtnTextColor(selectedOption) || 'inherit') +
                ' !important; fill: ' +
                (getBtnTextColor(selectedOption) || 'inherit') +
                ' !important; stroke: ' +
                (getBtnTextColor(selectedOption) || 'inherit') +
                ' !important;'
              "
            />
              <span
              :style="{ color: getBtnTextColor(selectedOption) || 'inherit' }"
              style="
                max-width: 140px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
              "
            >
              {{ selectedOption?.label ?? $text('ui.all_groups') }}
            </span>
          </div>
          <q-icon
            name="arrow_drop_down"
            :style="
              'color: ' + (getBtnTextColor(selectedOption) || 'inherit') + ' !important;'
            "
          />
        </q-btn>

        <q-menu v-model="menuOpen" self="bottom left" anchor="top left">
          <q-list padding>
            <q-item clickable v-ripple @click="onSelectAll">
              <q-item-section>
                <q-icon name="folder_open" />
              </q-item-section>
              <q-item-section>{{$text('ui.all_groups')}}</q-item-section>
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
                  <span
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

                    <q-tooltip>{{$text('ui.shortcut')}}</q-tooltip>
                  </span>
                </div>
              </template>
            </q-tree>
          </div>

          <q-separator />

          <q-list padding>
            <q-item clickable v-ripple @click="openManage">
              <q-item-section>{{$text('ui.manage_groups')}}</q-item-section>
            </q-item>
          </q-list>
        </q-menu>
      </div>
      <q-btn
        v-if="parentButtonVisible"
        flat
        dense
        round
        title="Go to parent group"
        @click.stop.prevent="() => api.group.active.goToParent()"
        :style="{
          border: '1px solid ' + (getBtnBorderColor(parentGroup?.value) || 'transparent'),
          background: 'transparent',
        }"
      >
        <q-icon
          name="arrow_upward"
          :style="
            'color: ' +
            (getBtnTextColor(parentGroup?.value) || 'inherit') +
            ' !important;'
          "
        />
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
          :text-color="getBtnTextColor(g)"
          :style="getShortcutStyle(g)"
        >
          <q-icon
            :name="g.icon || 'folder_open'"
            :style="`color: ${getBtnTextColor(g)} !important; fill: ${getBtnTextColor(
              g
            )} !important; stroke: ${getBtnTextColor(g)} !important;`"
          />
          <span
            :style="{ color: getBtnTextColor(g) }"
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
import { $text } from "src/modules/lang";
import * as api from "src/controllerRoot";

// color helpers for button contrast
function hexToRgb(hex: string) {
  if (!hex) return null;
  const h = String(hex).replace(/^#/, "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const bigint = parseInt(full, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return { r, g, b };
}

function getContrastColor(hex: string) {
  try {
    const rgb = hexToRgb(hex || "#1976d2");
    if (!rgb) return "#000";
    const r = rgb.r / 255;
    const g = rgb.g / 255;
    const b = rgb.b / 255;
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return lum > 0.6 ? "#000" : "#fff";
  } catch (e) {
    return "#000";
  }
}

function getBtnTextColor(g: any) {
  if (!g) return "inherit";
  return g.textColor || g.text_color || (g.color ? getContrastColor(g.color) : "inherit");
}

function rgbToHex(r: number, g: number, b: number) {
  const toHex = (n: number) =>
    Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function darkenHex(hex: string, amount: number) {
  try {
    const rgb = hexToRgb(hex);
    if (!rgb) return hex;
    const r = Math.round(rgb.r * (1 - amount));
    const g = Math.round(rgb.g * (1 - amount));
    const b = Math.round(rgb.b * (1 - amount));
    return rgbToHex(r, g, b);
  } catch (e) {
    return hex;
  }
}

function getBtnBorderColor(g: any) {
  if (!g) return "transparent";
  const base = g.color || null;
  if (base) return darkenHex(base, 0.35);
  return getBtnTextColor(g) || "transparent";
}

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
        : String(cur.value ?? "");
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

function getShortcutStyle(g: any) {
  try {
    const baseColor = g?.color || "transparent";
    const text = getBtnTextColor(g) || "transparent";
    const borderColor = getBtnBorderColor(g) || text;
    const isActive = isShortcutActive(g);
    let s = `background-color: ${baseColor} !important; border:1px solid ${borderColor}; padding: 4px 8px; min-height: 28px; display: inline-flex; align-items: center; gap: 8px; background-image: none !important; box-shadow: none !important;`;
    if (isActive) {
      s += ` outline: 2px dashed ${text} !important; outline-offset: 2px; pointer-events: none; cursor: default;`;
    }
    return s;
  } catch (e) {
    return ``;
  }
}

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
      localValue.value ?? activeGroup?.value?.value ?? null;
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
  outline: none;
  pointer-events: none;
  cursor: default;
}
</style>
