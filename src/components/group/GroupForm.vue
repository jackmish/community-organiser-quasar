<template>
  <q-form @submit.prevent="onSubmit" class="q-mb-md">
    <div style="display: flex; flex-direction: column; gap: 8px; width: 100%">
      <div class="row q-gutter-sm items-end">
        <q-input v-model="localName" label="Group Name" outlined dense class="col" />

        <!-- Icon preview and selector (moved out of the input) -->
        <div
          ref="gmIconPreview"
          class="gm-icon-preview gm-icon-swatch"
          @click.stop.prevent="toggleIconMenu"
          :style="{
            background: localColor,
            width: '36px',
            height: '36px',
            borderRadius: '6px',
            border: '1px solid #ffffff',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginLeft: '8px',
          }"
        >
          <q-icon
            :name="getIconName(localIcon)"
            :style="'color: ' + localTextColor + ' !important; '"
            size="24"
          />
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
              width: 44px;
              height: 44px;
              border-radius: 8px;
              cursor: pointer;
              border: 1px solid #0002;
              display: flex;
              align-items: center;
              justify-content: center;
              background: #f5f5f5;
            "
            :title="ic"
          >
            <q-icon :name="getIconName(ic)" size="24" />
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

        <q-input
          v-model="localColor"
          class="gm-color-field"
          label="Color (hex)"
          outlined
          dense
          style="width: 160px; overflow: visible"
        >
          <template #append>
            <div style="display: flex; align-items: center; gap: 8px">
              <div
                @click.stop.prevent="menuVisible = !menuVisible"
                style="
                  width: 30px;
                  height: 30px;
                  border-radius: 6px;
                  border: 1px solid white;
                  cursor: pointer;
                  box-sizing: border-box;
                "
                :style="{ background: localColor }"
              ></div>
              <div style="position: relative; display: inline-block">
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
                      ><div style="display: flex; align-items: center; gap: 8px">
                        <span>Custom…</span>
                        <div
                          :style="{
                            width: '18px',
                            height: '18px',
                            background: localColor,
                            borderRadius: '4px',
                            border: '1px solid rgba(0,0,0,0.12)',
                          }"
                        ></div></div
                    ></q-btn>
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
            </div>
          </template>
        </q-input>

        <!-- hidden color input used for native color picker fallback -->
        <input
          ref="colorInput"
          :value="localColor"
          @input="onColorInput"
          type="color"
          style="
            width: 30px;
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

        <!-- Text color selector (swatch + palette) -->
        <q-input
          v-model="localTextColor"
          class="gm-color-field"
          label="Text color (hex)"
          outlined
          dense
          style="width: 160px; margin-left: 8px; overflow: visible"
        >
          <template #append>
            <div style="display: flex; align-items: center; gap: 8px">
              <div
                :style="{
                  width: '30px',
                  height: '30px',
                  borderRadius: '6px',
                  border: '1px solid rgba(0,0,0,0.12)',
                  background: localTextColor,
                  boxSizing: 'border-box',
                }"
                @click.stop.prevent="textMenuVisible = !textMenuVisible"
              ></div>
              <div style="position: relative; display: inline-block">
                <div
                  v-if="textMenuVisible"
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
                    max-width: 200px;
                  "
                >
                  <div
                    v-for="c in textPalette"
                    :key="c"
                    @click="selectTextPaletteColor(c)"
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
                      @click="openTextCustom"
                      style="padding: 6px 10px"
                      >Custom…</q-btn
                    >
                    <q-btn
                      dense
                      unelevated
                      color="negative"
                      @click="resetTextColor"
                      style="padding: 6px 10px"
                      >Reset</q-btn
                    >
                  </div>
                </div>
              </div>
            </div>
          </template>
        </q-input>
        <input
          ref="textColorInput"
          :value="localTextColor"
          @input="onTextColorInput"
          type="color"
          style="
            width: 30px;
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
      </div>

      <!-- Second line: checkboxes and action buttons -->
      <div class="row q-gutter-sm items-center" style="margin-top: 8px; width: 100%">
        <div
          style="min-width: 180px; display: flex; align-items: center; position: relative"
          ref="parentBtnWrapper"
        >
          <q-btn
            flat
            dense
            round
            unelevated
            style="justify-content: flex-start"
            @click.stop.prevent="openParentMenu"
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

        <!-- fallback inline parent selector if QMenu doesn't mount -->
        <div v-if="parentMenuOpen" class="gm-parent-fallback" :style="parentMenuStyle">
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
import * as api from "src/modules/day-organiser/_apiRoot";
import type { QTreeNode } from "quasar";

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
const localTextColor = ref("#ffffff");

const colorInput = ref<HTMLInputElement | null>(null);
const textColorInput = ref<HTMLInputElement | null>(null);
const menuVisible = ref(false);
const textMenuVisible = ref(false);
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

const textPalette = computed(() => {
  const front = ["#000000", "#ffffff"];
  const rest = paletteColors.filter((c) => !front.includes(c));
  return [...front, ...rest];
});

const iconMenuVisible = ref(false);
const gmIconPreview = ref<HTMLElement | null>(null);
const iconMenuStyle = ref<Record<string, string>>({
  position: "fixed",
  left: "0px",
  top: "0px",
});
const parentBtnWrapper = ref<HTMLElement | null>(null);
const parentMenuStyle = ref<Record<string, string>>({
  position: "absolute",
  top: "calc(100% + 6px)",
  left: "0px",
  minWidth: "300px",
  maxHeight: "60vh",
  overflow: "auto",
  padding: "8px",
  background: "var(--q-popup-bg, #fff)",
  boxShadow: "0 6px 18px rgba(0, 0, 0, 0.12)",
  borderRadius: "6px",
  zIndex: "12000",
});

function openParentMenu() {
  try {
    const wrapper = parentBtnWrapper.value;
    if (!wrapper) {
      parentMenuOpen.value = true;
      return;
    }
    const rect = wrapper.getBoundingClientRect();
    const menuDesiredWidth = 320;
    let leftPx = 0;
    if (rect.left + menuDesiredWidth > window.innerWidth - 8) {
      // align to the right edge of the wrapper if it would overflow
      leftPx = Math.max(0, rect.width - menuDesiredWidth);
    } else {
      leftPx = 0;
    }
    parentMenuStyle.value = {
      position: "absolute",
      top: `${Math.round(rect.height + 6)}px`,
      left: `${Math.round(leftPx)}px`,
      minWidth: "300px",
      maxHeight: "60vh",
      overflow: "auto",
      padding: "8px",
      background: "var(--q-popup-bg, #fff)",
      boxShadow: "0 6px 18px rgba(0, 0, 0, 0.12)",
      borderRadius: "6px",
      zIndex: "12000",
    };
    parentMenuOpen.value = true;
  } catch (e) {
    void e;
    parentMenuOpen.value = true;
  }
}
const iconOptions = (() => {
  const set = new Set<string>();
  [
    // basic/folders
    "folder",
    "label",
    "bookmarks",
    "inbox",

    // people / groups
    "group",
    "group_add",
    "account_circle",
    "people",

    // places / home
    "home",
    "location_city",
    "place",
    "public",

    // transport / travel
    "directions_car",
    "local_shipping",
    "alt_route",
    "flight",
    "train",
    "directions_bus",
    "directions_bike",
    "directions_boat",
    "local_taxi",

    // food / coffee
    "restaurant",
    "local_dining",
    "local_cafe",
    "fastfood",

    // shopping / finance
    "shopping_cart",
    "local_grocery_store",
    "payment",
    "account_balance_wallet",
    "attach_money",
    "monetization_on",

    // media / camera
    "music_note",
    "movie",
    "videocam",
    "camera_alt",
    "photo_camera",

    // work / code / tools
    "work",
    "business",
    "code",
    "bug_report",
    "build",
    "settings",

    // calendar / time
    "schedule",
    "calendar_today",
    "alarm",
    "watch",

    // ideas / notes
    "lightbulb",
    "emoji_objects",
    "description",
    "note",

    // health / fitness
    "fitness_center",
    "sports_soccer",
    "sports_basketball",

    // nature / leisure
    "park",
    "local_florist",
    "spa",
    "beach_access",

    // misc
    "favorite",
    "star",
    "visibility",
    "palette",
    "brush",
    "camera",
    "mail",
    "chat",
    "comment",
    "place",
    "pets",
    "umbrella",
    "light_mode",
    "dark_mode",
    "cloud",
    "wifi",
    "battery_charging_full",
    "attach_file",
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
  [() => props.editingGroupId, () => props.groupOptions],
  ([id]) => {
    if (!id) {
      localName.value = "";
      localParent.value = null;
      localColor.value = "#1976d2";
      localIcon.value = "folder";
      localShareSubgroups.value = false;
      localHideTasksInParent.value = false;
      localShortcut.value = false;
      localTextColor.value = "#ffffff";
      return;
    }
    try {
      // Prefer a full group record from the provided groupTree (nodes include
      // the original `group` object). This ensures we populate all fields
      // (color, shortcut, textColor, etc.) rather than relying on the
      // lightweight `groupOptions` entries which only contain label/value.
      let full: any = null;
      try {
        const node = findNodeInTree(props.groupTree || [], String(id));
        if (node && node.group) full = node.group;
      } catch (err) {
        void err;
      }

      // Fallback: query the shared group list API for the full record.
      if (!full) {
        try {
          const listAny: any = api.group.list.all;
          const arr = Array.isArray(listAny) ? listAny : (listAny && listAny.value) || [];
          full = (arr || []).find((g: any) => String(g.id) === String(id));
        } catch (err) {
          void err;
        }
      }

      // Finally, fall back to groupOptions (label/value) if nothing else found
      const found = (props.groupOptions || []).find(
        (g: any) => String(g.id) === String(id) || String(g.value) === String(id)
      );

      const src = full || found || null;
      if (src) {
        localName.value = src.name || src.label || "";
        localParent.value = src.parentId || src.parent_id || null;
        localColor.value = src.color || "#1976d2";
        localTextColor.value = src.textColor || src.text_color || localTextColor.value;
        localIcon.value = src.icon || "folder";
        localShareSubgroups.value = Boolean(src.shareSubgroups);
        localHideTasksInParent.value = Boolean(src.hideTasksFromParent);
        localShortcut.value = Boolean(src.shortcut);
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
function onTextColorInput(e: Event) {
  const t = e.target as HTMLInputElement | null;
  if (t && typeof t.value === "string") localTextColor.value = t.value;
}
function selectTextPaletteColor(c: string) {
  localTextColor.value = c;
  textMenuVisible.value = false;
}
function resetTextColor() {
  localTextColor.value = "#ffffff";
  textMenuVisible.value = false;
}
function openTextCustom() {
  textMenuVisible.value = false;
  setTimeout(() => openTextColorPicker(), 120);
}

function openTextColorPicker() {
  try {
    if (textColorInput.value) {
      const orig = textColorInput.value;
      const clone = orig.cloneNode(true) as HTMLInputElement;
      clone.value = orig.value || localTextColor.value || "#ffffff";
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
        if (tt && typeof tt.value === "string") localTextColor.value = tt.value;
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
    temp.value = localTextColor.value || "#ffffff";
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
      if (tt && typeof tt.value === "string") localTextColor.value = tt.value;
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
    textColor: localTextColor.value,
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
::v-deep .gm-icon-item .q-icon,
::v-deep .gm-icon-item .q-icon * {
  color: rgba(0, 0, 0, 0.87) !important;
  fill: rgba(0, 0, 0, 0.87) !important;
  -webkit-text-fill-color: rgba(0, 0, 0, 0.87) !important;
}

/* Ensure icons inside the larger selector tiles scale up */
::v-deep .gm-icon-item .q-icon,
::v-deep .gm-icon-item .q-icon * {
  font-size: 22px !important;
  width: 22px !important;
  height: 22px !important;
  line-height: 22px !important;
}

/* Preview icon slightly smaller than tiles */
::v-deep .gm-icon-preview .q-icon,
::v-deep .gm-icon-preview .q-icon * {
  font-size: 24px !important;
  width: 24px !important;
  height: 24px !important;
  line-height: 24px !important;
}

/* Allow the preview to use the chosen text color (via CSS variable) */
.gm-icon-preview {
  --gm-text-color: #ffffff;
}
::v-deep .gm-icon-preview .q-icon,
::v-deep .gm-icon-preview .q-icon * {
  color: var(--gm-text-color) !important;
  fill: var(--gm-text-color) !important;
  -webkit-text-fill-color: var(--gm-text-color) !important;
}

/* Reduce right padding inside the color/text-color inputs */
::v-deep .gm-color-field .q-field__control {
  padding-right: 6px !important;
}
::v-deep .gm-color-field .q-field__append {
  margin-left: 6px !important;
}

/* content-class for parent menu to ensure it stacks above overlays */
.gm-parent-menu-content {
  z-index: 12000 !important;
}
</style>
