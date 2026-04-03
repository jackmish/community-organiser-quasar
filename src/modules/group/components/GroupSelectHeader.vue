<template>
  <div
    style="
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      justify-content: flex-end;
    "
  >
    <template v-if="optionsReady">
      <!-- Middle: select + parent -->
      <div
        style="
          display: flex;
          align-items: center;
          gap: 8px;
          flex: 1;
          justify-content: center;
        "
      >
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
                {{ selectedOption?.label ?? $text("ui.all_groups") }}
              </span>
            </div>
            <q-icon
              name="arrow_drop_down"
              :style="
                'color: ' +
                (getBtnTextColor(selectedOption) || 'inherit') +
                ' !important;'
              "
            />
          </q-btn>

          <q-menu v-model="menuOpen" self="bottom left" anchor="top left">
            <q-list padding>
              <q-item clickable v-ripple @click="onSelectAll">
                <q-item-section>
                  <q-icon name="folder_open" />
                </q-item-section>
                <q-item-section>{{ $text("ui.all_groups") }}</q-item-section>
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

                      <q-tooltip>{{ $text("ui.shortcut") }}</q-tooltip>
                    </span>
                  </div>
                </template>
              </q-tree>
            </div>

            <q-separator />

            <q-list padding>
              <q-item clickable v-ripple @click="openManage">
                <q-item-section>{{ $text("ui.manage_groups") }}</q-item-section>
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
          @click.stop.prevent="() => CC.group.active.goToParent()"
          :style="{
            border:
              '1px solid ' + (getBtnBorderColor(parentGroup?.value) || 'transparent'),
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
      </div>

      <!-- Right slot: options menu for the current group -->
      <div style="display: flex; align-items: center">
        <TaskListOptionsMenu :text-color="getBtnTextColor(selectedOption) || undefined" />
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
import CC from "src/CCAccess";
import { getContrastColor, darkenHex } from "src/utils/colorUtils";
import TaskListOptionsMenu from "src/modules/task/components/TaskListOptionsMenu.vue";

function getBtnTextColor(g: any) {
  if (!g) return "inherit";
  return g.textColor || g.text_color || (g.color ? getContrastColor(g.color) : "inherit");
}

function getBtnBorderColor(g: any) {
  if (!g) return "transparent";
  const base = g.color || null;
  if (base) return darkenHex(base, 0.35);
  return getBtnTextColor(g) || "transparent";
}

const groups = CC.group.list.all;
const activeGroup = CC.group.active.activeGroup;
const parentGroup = CC.group.active.parent;
const isLoading = CC.storage.isLoading;

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
    return (CC.group.list.tree.value || []).map(convertNode);
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
      CC.group.active.set(fg);
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
        CC.group.active.set(found);
      if (localValue.value !== gid) localValue.value = gid;
    }
  },
  { immediate: true }
);

function onSelectAll() {
  // delegate the canonical selection change to the shared API
  CC.group.active.selectAll();
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
    // options.value contains lightweight option objects; find the full
    // group record from the authoritative groups list and pass that to
    // the group's activate API so it receives the expected shape.
    const groupObj = (groups.value || []).find((g: any) => String(g.id) === String(key));
    if (groupObj) CC.group.active.set(groupObj);
    else CC.group.active.setById(String(key));
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

function activateTreeShortcut(node: any) {
  try {
    const grp =
      node && node.group
        ? node.group
        : (groups.value || []).find((gg: any) => String(gg.id) === String(node.id));
    if (grp) CC.group.active.set(grp);
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

</script>

<style scoped></style>
