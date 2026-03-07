<template>
  <q-form @submit.prevent="onSubmit" class="q-mb-md">
    <div style="display: flex; flex-direction: column; gap: 8px; width: 100%">
      <div class="row q-gutter-sm items-end">
        <q-input v-model="localName" label="Group Name" outlined dense class="col" />

        <div style="min-width: 180px; display: flex; align-items: center">
          <q-btn
            flat
            dense
            round
            unelevated
            style="flex: 1; justify-content: flex-start"
            @click.stop.prevent="parentMenuOpen = !parentMenuOpen"
          >
            <div style="display: flex; align-items: center; gap: 8px">
              <q-icon
                :name="getIconName(localParentIcon)"
                :style="{ color: localParentColor || 'inherit' }"
              />
              <span
                style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis"
                >{{ parentLabel }}</span
              >
            </div>
          </q-btn>
        </div>

        <q-input
          :model-value="''"
          label="Color"
          outlined
          dense
          style="max-width: 120px; overflow: visible"
        >
          <template #append>
            <div class="gm-controls" style="display: flex; align-items: center; gap: 8px">
              <div
                @click.stop.prevent="menuVisible = !menuVisible"
                style="
                  width: 28px;
                  height: 20px;
                  border-radius: 4px;
                  border: 1px solid rgba(0, 0, 0, 0.12);
                  cursor: pointer;
                  margin-right: 8px;
                  box-sizing: border-box;
                "
                :style="{ background: localColor }"
              ></div>
              <div
                ref="gmIconPreview"
                class="gm-icon-preview"
                @click.stop.prevent="toggleIconMenu"
                style="
                  width: 28px;
                  height: 20px;
                  border-radius: 4px;
                  border: 1px solid rgba(0, 0, 0, 0.12);
                  cursor: pointer;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  background: #f5f5f5;
                "
              >
                <q-icon :name="getIconName(localIcon)" size="18" />
              </div>

              <div
                v-if="iconMenuVisible"
                :style="iconMenuStyle"
                style="
                  background: var(--q-popup-bg, #fff);
                  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.12);
                  padding: 8px;
                  border-radius: 6px;
                  z-index: 10010;
                  display: flex;
                  flex-wrap: wrap;
                  gap: 6px;
                  max-width: 320px;
                "
              >
                <div
                  v-for="ic in iconOptions"
                  :key="ic"
                  class="gm-icon-item"
                  @click="selectIcon(ic)"
                  style="
                    width: 36px;
                    height: 36px;
                    border-radius: 6px;
                    cursor: pointer;
                    border: 1px solid #0002;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: #f5f5f5;
                  "
                  :title="ic"
                >
                  <q-icon :name="getIconName(ic)" />
                </div>
                <div style="flex-basis: 100%; height: 0"></div>
                <div
                  style="
                    width: 100%;
                    margin-top: 6px;
                    display: flex;
                    gap: 6px;
                    align-items: center;
                  "
                >
                  <q-btn
                    dense
                    unelevated
                    color="primary"
                    @click="resetIcon"
                    style="padding: 6px 10px"
                    >Reset Icon</q-btn
                  >
                </div>
              </div>
            </div>

            <input
              ref="colorInput"
              :value="localColor"
              @input="onColorInput"
              type="color"
              style="
                width: 40px;
                height: 30px;
                border: none;
                cursor: pointer;
                position: relative;
                z-index: 100000;
                pointer-events: auto;
                opacity: 0;
                position: absolute;
                left: -9999px;
              "
            />

            <div style="position: relative; display: inline-block">
              <q-btn
                dense
                flat
                round
                icon="palette"
                @click.stop.prevent="menuVisible = !menuVisible"
                class="q-ml-sm"
              />

              <div
                v-if="menuVisible"
                style="
                  position: absolute;
                  right: 0;
                  top: calc(100% + 6px);
                  background: var(--q-popup-bg, #fff);
                  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.12);
                  padding: 8px;
                  border-radius: 6px;
                  z-index: 10010;
                  display: flex;
                  flex-wrap: wrap;
                  gap: 6px;
                  max-width: 240px;
                "
              >
                <div
                  v-for="c in paletteColors"
                  :key="c"
                  @click="selectPaletteColor(c)"
                  style="
                    width: 28px;
                    height: 28px;
                    border-radius: 4px;
                    cursor: pointer;
                    border: 1px solid #0002;
                  "
                  :title="c"
                  :style="{ background: c }"
                ></div>
                <div style="flex-basis: 100%; height: 0"></div>
                <div
                  style="
                    width: 100%;
                    margin-top: 6px;
                    display: flex;
                    gap: 6px;
                    align-items: center;
                  "
                >
                  <q-btn
                    dense
                    unelevated
                    color="primary"
                    @click="openCustom"
                    style="
                      display: flex;
                      align-items: center;
                      gap: 8px;
                      padding: 6px 10px;
                    "
                  >
                    <div style="display: flex; align-items: center; gap: 8px">
                      <span>Custom…</span>
                      <div
                        :style="{
                          width: '18px',
                          height: '18px',
                          background: localColor,
                          borderRadius: '4px',
                          border: '1px solid rgba(0,0,0,0.12)',
                        }"
                      ></div>
                    </div>
                  </q-btn>
                  <q-btn
                    dense
                    unelevated
                    color="negative"
                    @click="resetColor"
                    style="padding: 6px 10px"
                    >Reset</q-btn
                  >
                </div>
              </div>
            </div>
          </template>
        </q-input>
      </div>

      <!-- Second line: checkboxes and action buttons -->
      <div class="row q-gutter-sm items-center" style="margin-top: 8px; width: 100%">
        <q-menu
          v-model="parentMenuOpen"
          anchor="bottom left"
          self="top left"
          :offset="[0, 6]"
        >
          <div style="min-width: 300px; max-height: 60vh; overflow: auto; padding: 8px">
            <q-list padding>
              <q-item clickable v-ripple @click="clearParent">
                <q-item-section avatar style="min-width: 36px"
                  ><q-icon name="folder_open"
                /></q-item-section>
                <q-item-section>None (no parent)</q-item-section>
              </q-item>
            </q-list>
            <q-separator />
            <div style="max-height: 44vh; overflow: auto; padding-top: 6px">
              <q-tree
                :nodes="groupTree || []"
                node-key="id"
                default-expand-all
                :selected="localParent ? [String(localParent)] : []"
                @update:selected="onParentTreeSelect"
              >
                <template #default-header="prop">
                  <div class="row items-center full-width">
                    <q-icon
                      :name="getIconName(prop.node.icon)"
                      class="q-mr-sm"
                      :style="{ color: prop.node.color }"
                    />
                    <span>{{ prop.node.label }}</span>
                  </div>
                </template>
              </q-tree>
            </div>
            <q-separator />
            <div
              style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 6px"
            >
              <q-btn dense flat label="Cancel" @click="parentMenuOpen = false" />
            </div>
          </div>
        </q-menu>
        <div style="display: flex; align-items: center; gap: 8px">
          <q-checkbox v-model="localShareSubgroups" label="Share subgroups" dense />
        </div>

        <div style="display: flex; align-items: center; gap: 8px">
          <q-checkbox
            v-model="localHideTasksInParent"
            label="Hide tasks from parent"
            dense
          />
        </div>

        <div style="display: flex; align-items: center; gap: 8px">
          <q-checkbox v-model="localShortcut" label="Make shortcut" dense />
        </div>

        <div style="margin-left: auto; display: flex; gap: 8px; align-items: center">
          <q-btn v-if="!editingGroupId" type="submit" color="primary" icon="add" dense />
          <q-btn v-else type="submit" color="primary" icon="save" dense />
          <q-btn
            v-if="editingGroupId"
            flat
            label="Cancel"
            color="primary"
            @click.prevent="onCancel"
          />
        </div>
      </div>
    </div>
  </q-form>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import type { QTreeNode } from "quasar";
import * as api from "src/modules/day-organiser/_apiRoot";

const props = defineProps<{
  groupTree?: QTreeNode<any>[];
  groupOptions?: any[];
  editingGroupId?: string | null;
}>();
const emit = defineEmits<{
  (e: "submit", payload: any): void;
  (e: "cancel"): void;
}>();

const localName = ref("");
const localParent = ref<string | null>(null);
const parentMenuOpen = ref(false);
const localParentIcon = ref<string | null>(null);
const localParentColor = ref<string | null>(null);
const localColor = ref("#1976d2");
const localIcon = ref<string | null>("folder");
const localShareSubgroups = ref(false);
const localHideTasksInParent = ref(false);
const localShortcut = ref(false);

const colorInput = ref<HTMLInputElement | null>(null);
const menuVisible = ref(false);
const paletteColors = [
  "#1976d2",
  "#e91e63",
  "#9c27b0",
  "#ff9800",
  "#4caf50",
  "#f44336",
  "#795548",
  "#607d8b",
  "#ffffff",
  "#000000",
];

const iconMenuVisible = ref(false);
const gmIconPreview = ref<HTMLElement | null>(null);
const iconMenuStyle = ref<Record<string, string>>({
  position: "fixed",
  left: "0px",
  top: "0px",
});
const iconOptions = (() => {
  const set = new Set<string>();
  [
    "folder",
    "label",
    "group",
    "account_circle",
    "bookmarks",
    "home",
    "location_city",
    "factory",
    "park",
    "directions_car",
    "local_shipping",
    "alt_route",
  ].forEach((i) => set.add(i));
  return Array.from(set);
})();

const iconAlias: Record<string, string> = {
  house: "home",
  skyscraper: "location_city",
  factory: "factory",
  tree: "park",
  car: "directions_car",
  truck: "local_shipping",
  road: "alt_route",
};
function getIconName(key?: string | null) {
  if (!key) return "folder";
  return (iconAlias as any)[key] || key;
}

function toggleIconMenu() {
  try {
    if (iconMenuVisible.value) {
      iconMenuVisible.value = false;
      return;
    }
    const el = gmIconPreview.value;
    if (!el) {
      iconMenuVisible.value = true;
      return;
    }
    const r = el.getBoundingClientRect();
    const left = Math.min(window.innerWidth - 340, r.right - 44);
    const top = Math.min(window.innerHeight - 200, r.bottom + 6);
    iconMenuStyle.value = { position: "fixed", left: `${left}px`, top: `${top}px` };
    iconMenuVisible.value = true;
  } catch (e) {
    void e;
    iconMenuVisible.value = !iconMenuVisible.value;
  }
}
function selectIcon(ic: string) {
  localIcon.value = ic;
  iconMenuVisible.value = false;
}
function resetIcon() {
  localIcon.value = "folder";
  iconMenuVisible.value = false;
}

function findNodeInTree(nodes: any[], key: string): any {
  for (const n of nodes || []) {
    if (String(n.id) === String(key)) return n;
    const f = findNodeInTree(n.children || [], key);
    if (f) return f;
  }
  return null;
}

function onParentTreeSelect(val: any) {
  const key = Array.isArray(val) ? val[0] : val;
  if (!key) return;
  localParent.value = String(key);
  try {
    const node = findNodeInTree(props.groupTree || [], String(key));
    if (node) {
      localParentIcon.value = node.icon || null;
      localParentColor.value = node.color || null;
    }
  } catch (e) {
    void e;
  }
  parentMenuOpen.value = false;
}
function clearParent() {
  localParent.value = null;
  localParentIcon.value = null;
  localParentColor.value = null;
  parentMenuOpen.value = false;
}

const parentLabel = computed(() => {
  if (!localParent.value) return "Parent Group (optional)";
  try {
    const node = findNodeInTree(props.groupTree || [], String(localParent.value));
    if (node) return node.label || String(localParent.value);
  } catch (e) {
    void e;
  }
  const opt = (props.groupOptions || []).find(
    (o: any) => String(o.value) === String(localParent.value)
  );
  return opt?.label || String(localParent.value);
});

watch(
  () => props.editingGroupId,
  (id) => {
    if (!id) {
      localName.value = "";
      localParent.value = null;
      localColor.value = "#1976d2";
      localIcon.value = "folder";
      localShareSubgroups.value = false;
      localHideTasksInParent.value = false;
      localShortcut.value = false;
      return;
    } // try populate from props.groupOptions
    try {
      const found = (props.groupOptions || []).find(
        (g: any) => String(g.id) === String(id) || String(g.value) === String(id)
      );
      if (found) {
        localName.value = found.name || found.label || "";
        localParent.value = found.parentId || found.parent_id || null;
        localColor.value = found.color || "#1976d2";
        localIcon.value = found.icon || "folder";
        localShareSubgroups.value = Boolean(found.shareSubgroups);
        localHideTasksInParent.value = Boolean(found.hideTasksFromParent);
        localShortcut.value = Boolean(found.shortcut);
      }
    } catch (e) {
      void e;
    }
  },
  { immediate: true }
);

function onColorInput(e: Event) {
  const t = e.target as HTMLInputElement | null;
  if (t && typeof t.value === "string") localColor.value = t.value;
}
function selectPaletteColor(c: string) {
  localColor.value = c;
  menuVisible.value = false;
}
function resetColor() {
  localColor.value = "#1976d2";
  menuVisible.value = false;
}
function openCustom() {
  menuVisible.value = false;
  setTimeout(() => openColorPicker(), 120);
}

function openColorPicker() {
  try {
    if (colorInput.value) {
      const orig = colorInput.value;
      const clone = orig.cloneNode(true) as HTMLInputElement;
      clone.value = orig.value || localColor.value || "#1976d2";
      clone.style.position = "fixed";
      clone.style.width = "1px";
      clone.style.height = "1px";
      clone.style.opacity = "0";
      clone.style.pointerEvents = "auto";
      try {
        const rect = orig.getBoundingClientRect();
        const left = Math.max(0, rect.left + window.scrollX + 4);
        const top = Math.max(0, rect.bottom + window.scrollY + 4);
        clone.style.left = `${left}px`;
        clone.style.top = `${top}px`;
      } catch (e) {
        void e;
        clone.style.left = "0px";
        clone.style.top = "0px";
      }
      document.body.appendChild(clone);
      const onInputClone = (ev: Event) => {
        const tt = ev.target as HTMLInputElement | null;
        if (tt && typeof tt.value === "string") localColor.value = tt.value;
      };
      clone.addEventListener("input", onInputClone);
      clone.addEventListener("change", onInputClone);
      setTimeout(() => {
        try {
          clone.click();
        } catch (e) {
          void e;
        }
      }, 50);
      setTimeout(() => {
        clone.removeEventListener("input", onInputClone);
        clone.removeEventListener("change", onInputClone);
        if (clone.parentElement) clone.parentElement.removeChild(clone);
      }, 5000);
      return;
    }

    const temp = document.createElement("input");
    temp.type = "color";
    temp.value = localColor.value || "#1976d2";
    temp.style.position = "fixed";
    temp.style.left = "0";
    temp.style.top = "0";
    temp.style.width = "1px";
    temp.style.height = "1px";
    temp.style.opacity = "0";
    temp.style.pointerEvents = "auto";
    document.body.appendChild(temp);

    const onInput = (ev: Event) => {
      const tt = ev.target as HTMLInputElement | null;
      if (tt && typeof tt.value === "string") localColor.value = tt.value;
    };

    temp.addEventListener("input", onInput);
    temp.addEventListener("change", onInput);

    setTimeout(() => {
      try {
        temp.click();
      } catch (e) {
        void e;
      }
    }, 50);

    setTimeout(() => {
      temp.removeEventListener("input", onInput);
      temp.removeEventListener("change", onInput);
      if (temp.parentElement) temp.parentElement.removeChild(temp);
    }, 5000);
  } catch (e) {
    void e;
  }
}

function onSubmit() {
  const payload = {
    name: localName.value.trim(),
    parent: localParent.value || undefined,
    color: localColor.value,
    icon: localIcon.value,
    shareSubgroups: localShareSubgroups.value,
    hideTasksFromParent: localHideTasksInParent.value,
    shortcut: localShortcut.value,
  };
  if (!payload.name) return;
  emit("submit", payload);
}
function onCancel() {
  emit("cancel");
}
</script>

<style scoped>
::v-deep .gm-controls .q-icon,
::v-deep .gm-controls .q-icon *,
::v-deep .gm-icon-preview .q-icon,
::v-deep .gm-icon-item .q-icon,
::v-deep .gm-icon-item .q-icon * {
  color: rgba(0, 0, 0, 0.87) !important;
  fill: rgba(0, 0, 0, 0.87) !important;
  -webkit-text-fill-color: rgba(0, 0, 0, 0.87) !important;
}
</style>
