<template>
  <q-form @submit.prevent="onSubmit" class="q-mb-md">
    <div style="display: flex; flex-direction: column; gap: 8px; width: 100%">
      <div class="row q-gutter-sm items-end">
        <q-input
          v-model="localName"
          :label="$text('label.group_name')"
          outlined
          dense
          class="col"
        />
        <q-input
          v-model="localLocalName"
          :label="$text('label.group_local_name')"
          outlined
          dense
          class="col"
        />

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
        <q-menu
          v-model="iconMenuVisible"
          :target="gmIconPreview ?? undefined"
          anchor="bottom left"
          self="top left"
          :offset="[0, 6]"
          :content-style="iconPopupStyle"
          content-class="gm-popup-menu"
          no-parent-event
        >
          <div class="gm-icon-picker-panel">
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
                >{{ $text('action.reset_icon') }}</q-btn
              >
            </div>
          </div>
        </q-menu>

        <q-input
          v-model="localColor"
          class="gm-color-field"
          :label="$text('label.color_hex')"
          outlined
          dense
          style="width: 160px; overflow: visible"
        >
          <template #append>
            <div
              ref="colorSwatchRef"
              class="gm-color-swatch-trigger"
              :style="{ background: localColor }"
              @click.stop.prevent="toggleColorMenu"
            />
            <q-menu
              v-model="menuVisible"
              :target="colorSwatchRef ?? undefined"
              anchor="bottom right"
              self="top right"
              :offset="[0, 6]"
              :max-height="colorCustomMode ? 'min(90vh, 640px)' : '520px'"
              persistent
              :content-style="colorPopupStyle"
              content-class="gm-popup-menu gm-color-palette-menu"
              no-parent-event
              @hide="colorCustomMode = false"
            >
              <div v-if="!colorCustomMode" class="gm-color-palette" @click.stop>
                <div class="gm-color-palette__grid">
                  <button
                    v-for="c in paletteColors"
                    :key="c"
                    type="button"
                    class="gm-color-palette__swatch"
                    :title="c"
                    :style="{ background: c }"
                    :class="{ 'gm-color-palette__swatch--selected': localColor === c }"
                    @click="selectPaletteColor(c)"
                  />
                </div>
                <div class="gm-color-palette__actions">
                  <q-btn
                    dense
                    unelevated
                    color="primary"
                    class="gm-color-palette__action-btn"
                    @click="openColorCustomPanel"
                  >
                    <span>{{ $text('action.custom') }}</span>
                    <div
                      class="gm-color-palette__action-preview"
                      :style="{ background: localColor }"
                    />
                  </q-btn>
                  <q-btn
                    dense
                    unelevated
                    color="negative"
                    :label="$text('action.reset')"
                    class="gm-color-palette__action-btn"
                    @click="resetColor"
                  />
                </div>
              </div>
              <div v-else class="gm-color-custom-panel" @click.stop>
                <div class="text-subtitle2 q-mb-sm">{{ $text('action.custom') }}</div>
                <q-color
                  v-model="draftColor"
                  format-model="hex"
                  default-view="spectrum"
                  no-header
                  no-footer
                  bordered
                  class="gm-q-color-picker"
                />
                <div class="gm-color-custom-panel__below">
                  <div
                    class="gm-color-custom-preview"
                    :style="{ background: draftColor }"
                    aria-hidden="true"
                  />
                  <q-input
                    v-model="draftColor"
                    dense
                    outlined
                    class="gm-color-custom-hex"
                    :label="$text('label.color_hex')"
                  />
                </div>
                <div class="gm-color-palette__footer">
                  <q-btn
                    type="button"
                    dense
                    flat
                    :label="$text('action.cancel')"
                    @click="cancelColorCustom"
                  />
                  <q-btn
                    type="button"
                    dense
                    unelevated
                    color="primary"
                    :label="$text('action.confirm')"
                    @click="confirmColorCustom"
                  />
                </div>
              </div>
            </q-menu>
          </template>
        </q-input>

        <!-- Text color selector (swatch + palette) -->
        <q-input
          v-model="localTextColor"
          class="gm-color-field"
          :label="$text('label.text_color_hex')"
          outlined
          dense
          style="width: 160px; margin-left: 8px; overflow: visible"
        >
          <template #append>
            <div
              ref="textColorSwatchRef"
              class="gm-color-swatch-trigger gm-color-swatch-trigger--text"
              :style="{ background: localTextColor }"
              @click.stop.prevent="toggleTextColorMenu"
            />
            <q-menu
              v-model="textMenuVisible"
              :target="textColorSwatchRef ?? undefined"
              anchor="bottom right"
              self="top right"
              :offset="[0, 6]"
              :max-height="textColorCustomMode ? 'min(90vh, 640px)' : '360px'"
              persistent
              :content-style="textColorPopupStyle"
              content-class="gm-popup-menu gm-color-palette-menu"
              no-parent-event
              @hide="textColorCustomMode = false"
            >
              <div v-if="!textColorCustomMode" class="gm-color-palette gm-color-palette--text" @click.stop>
                <div class="gm-color-palette__grid gm-color-palette__grid--text">
                  <button
                    v-for="c in textPalette"
                    :key="c"
                    type="button"
                    class="gm-color-palette__swatch"
                    :title="c"
                    :style="{ background: c }"
                    :class="{ 'gm-color-palette__swatch--selected': localTextColor === c }"
                    @click="selectTextPaletteColor(c)"
                  />
                </div>
                <div class="gm-color-palette__actions">
                  <q-btn
                    dense
                    unelevated
                    color="primary"
                    class="gm-color-palette__action-btn"
                    @click="openTextColorCustomPanel"
                  >
                    <span>{{ $text('action.custom') }}</span>
                    <div
                      class="gm-color-palette__action-preview"
                      :style="{ background: localTextColor }"
                    />
                  </q-btn>
                  <q-btn
                    dense
                    unelevated
                    color="negative"
                    :label="$text('action.reset')"
                    class="gm-color-palette__action-btn"
                    @click="resetTextColor"
                  />
                </div>
              </div>
              <div v-else class="gm-color-custom-panel" @click.stop>
                <div class="text-subtitle2 q-mb-sm">{{ $text('action.custom') }}</div>
                <q-color
                  v-model="draftTextColor"
                  format-model="hex"
                  default-view="spectrum"
                  no-header
                  no-footer
                  bordered
                  class="gm-q-color-picker"
                />
                <div class="gm-color-custom-panel__below">
                  <div
                    class="gm-color-custom-preview"
                    :style="{ background: draftTextColor }"
                    aria-hidden="true"
                  />
                  <q-input
                    v-model="draftTextColor"
                    dense
                    outlined
                    class="gm-color-custom-hex"
                    :label="$text('label.text_color_hex')"
                  />
                </div>
                <div class="gm-color-palette__footer">
                  <q-btn
                    type="button"
                    dense
                    flat
                    :label="$text('action.cancel')"
                    @click="cancelTextColorCustom"
                  />
                  <q-btn
                    type="button"
                    dense
                    unelevated
                    color="primary"
                    :label="$text('action.confirm')"
                    @click="confirmTextColorCustom"
                  />
                </div>
              </div>
            </q-menu>
          </template>
        </q-input>
      </div>

      <div class="row items-center q-gutter-sm gm-bg-row q-mt-xs" style="width: 100%">
        <q-btn
          dense
          unelevated
          color="primary"
          icon="image"
          :label="$text('action.load_group_image')"
          @click="pickBackgroundImage"
        />
        <q-btn
          v-if="localBackgroundImage"
          dense
          flat
          color="negative"
          icon="clear"
          :label="$text('action.remove_group_image')"
          @click="clearBackgroundImage"
        />
        <q-checkbox
          v-model="localLayoutColorize"
          :label="$text('label.colorize_group_layout')"
          dense
        />
        <q-checkbox
          v-if="localLayoutColorize"
          v-model="localBgColorize"
          :label="$text('label.colorize_group_bg')"
          dense
          class="q-ml-lg"
        />
        <q-checkbox
          v-if="localLayoutColorize"
          v-model="localCalendarColorize"
          :label="$text('label.colorize_group_calendar')"
          dense
          class="q-ml-lg"
        />
        <div class="gm-bg-preview" :title="$text('label.group_background_preview')">
          <div class="gm-bg-preview__photo" :style="bgPreviewPhotoStyle" />
          <div
            v-if="bgPreviewWashStyle"
            class="gm-bg-preview__wash"
            :style="bgPreviewWashStyle"
          />
        </div>
        <input
          ref="bgImageInput"
          type="file"
          accept="image/*"
          style="display: none"
          @change="onBackgroundImageSelected"
        />
      </div>

      <!-- Second line: checkboxes and action buttons -->
      <div class="row q-gutter-sm items-center" style="margin-top: 8px; width: 100%">
        <q-btn
          flat
          round
          dense
          unelevated
          class="gm-parent-activator"
          style="min-width: 180px; justify-content: flex-start"
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
            <GroupTreeSelector
              class="q-mt-sm"
              :nodes="lockedParentTree"
              :selected="localParent ? [String(localParent)] : []"
              max-height="44vh"
              @update:selected="onParentTreeSelect"
            >
              <template #header="prop">
                <div class="row items-center full-width">
                  <q-icon
                    :name="getIconName(prop.node.icon)"
                    class="q-mr-sm"
                    :style="{ color: prop.node.color }"
                  />
                  <span>{{ prop.node.label }}</span>
                </div>
              </template>
            </GroupTreeSelector>
            <q-separator />
            <div
              style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 6px"
            >
              <q-btn
                dense
                flat
                :label="$text('action.cancel')"
                @click="parentMenuOpen = false"
              />
            </div>
          </div>
        </q-menu>

        <div style="display: flex; align-items: center; gap: 8px">
          <q-checkbox
            v-model="localShareSubgroups"
            :label="$text('label.share_subgroups')"
            dense
          />
        </div>

        <div style="display: flex; align-items: center; gap: 8px">
          <q-checkbox
            v-model="localHideTasksInParent"
            :label="$text('label.parent_summary')"
            dense
          />
        </div>

        <div style="display: flex; align-items: center; gap: 8px">
          <q-checkbox
            v-model="localShortcut"
            :label="$text('label.make_shortcut')"
            dense
          />
        </div>

        <div style="margin-left: auto; display: flex; gap: 8px; align-items: center">
          <q-btn v-if="!editingGroupId" type="submit" color="primary" icon="add" dense />
          <q-btn v-else type="submit" color="primary" icon="save" dense />
          <q-btn
            v-if="editingGroupId"
            flat
            :label="$text('action.cancel')"
            color="primary"
            @click.prevent="onCancel"
          />
        </div>
      </div>
    </div>

  </q-form>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { $text } from "src/modules/lang";
import CC from "src/CCAccess";
import { popupZIndexAboveDialogs } from "src/utils/stackingZIndex";
import {
  GROUP_BACKGROUND_PALETTE,
  GROUP_DEFAULT_BACKGROUND,
  GROUP_DEFAULT_TEXT_COLOR,
  GROUP_TEXT_PALETTE,
} from "src/modules/group/constants/groupPaletteColors";
import {
  groupBackgroundLayerBundle,
  readGroupBackgroundFields,
  resolveGroupBackground,
} from "src/modules/group/utils/groupBackground";
import { resolveGroupBackgroundDisplayUrl } from "src/modules/group/utils/groupBackgroundStorage";
import { appNotify } from "src/utils/appNotify";
import type { QTreeNode } from "quasar";
import { treeNodesExpandedOnly } from "src/modules/group/utils/treeUi";
import GroupTreeSelector from "./GroupTreeSelector.vue";
import { getLocalGroupName } from "src/modules/group/utils/groupLocalNames";

const props = defineProps<{
  groupTree?: QTreeNode<any>[];
  groupOptions?: any[];
  editingGroupId?: string | null;
  initialParentId?: string | null;
}>();
const emit = defineEmits<{
  (e: "submit", payload: any): void;
  (e: "cancel"): void;
}>();

const lockedParentTree = computed(() =>
  treeNodesExpandedOnly((props.groupTree || []) as QTreeNode[]),
);

const localName = ref("");
const localLocalName = ref("");
const localParent = ref<string | null>(null);
const parentMenuOpen = ref(false);
const localParentIcon = ref<string | null>(null);
const localParentColor = ref<string | null>(null);
const localColor = ref(GROUP_DEFAULT_BACKGROUND);
const localIcon = ref<string | null>("folder");
const localShareSubgroups = ref(false);
const localHideTasksInParent = ref(false);
const localShortcut = ref(false);
const localTextColor = ref(GROUP_DEFAULT_TEXT_COLOR);
const localBackgroundImage = ref<string | null>(null);
const localLayoutColorize = ref(false);
const localBgColorize = ref(true);
const localCalendarColorize = ref(true);
const bgImageInput = ref<HTMLInputElement | null>(null);

const MAX_GROUP_BG_BYTES = 5 * 1024 * 1024;

const bgPreviewBundle = computed(() =>
  groupBackgroundLayerBundle(
    resolveGroupBackground({
      id: props.editingGroupId || '__preview',
      backgroundImage: localBackgroundImage.value,
      layoutColorize: localLayoutColorize.value,
      backgroundColorize: localBgColorize.value,
      color: localColor.value,
    }),
  ),
);
const bgPreviewPhotoStyle = computed(() => bgPreviewBundle.value.photo);
const bgPreviewWashStyle = computed(() => bgPreviewBundle.value.wash);

const colorSwatchRef = ref<HTMLElement | null>(null);
const textColorSwatchRef = ref<HTMLElement | null>(null);
const menuVisible = ref(false);
const textMenuVisible = ref(false);
const colorCustomMode = ref(false);
const textColorCustomMode = ref(false);
const draftColor = ref(GROUP_DEFAULT_BACKGROUND);
const draftTextColor = ref(GROUP_DEFAULT_TEXT_COLOR);

const colorPopupStyle = computed(() => ({
  zIndex: popupZIndexAboveDialogs(colorSwatchRef.value),
}));
const textColorPopupStyle = computed(() => ({
  zIndex: popupZIndexAboveDialogs(textColorSwatchRef.value),
}));
const iconPopupStyle = computed(() => ({
  zIndex: popupZIndexAboveDialogs(gmIconPreview.value),
}));
const paletteColors = GROUP_BACKGROUND_PALETTE;
const textPalette = GROUP_TEXT_PALETTE;

const iconOptions = (() => {
  const set = new Set<string>();
  [
    "folder",
    "label",
    "bookmarks",
    "inbox",
    "group",
    "group_add",
    "account_circle",
    "people",
    "home",
    "location_city",
    "place",
    "public",
    "directions_car",
    "local_shipping",
    "alt_route",
    "flight",
    "train",
    "directions_bus",
    "directions_bike",
    "directions_boat",
    "local_taxi",
    "restaurant",
    "local_dining",
    "local_cafe",
    "fastfood",
    "shopping_cart",
    "local_grocery_store",
    "payment",
    "account_balance_wallet",
    "attach_money",
    "monetization_on",
    "music_note",
    "movie",
    "videocam",
    "camera_alt",
    "photo_camera",
    "work",
    "business",
    "code",
    "bug_report",
    "build",
    "settings",
    "schedule",
    "calendar_today",
    "alarm",
    "watch",
    "lightbulb",
    "emoji_objects",
    "description",
    "note",
    "fitness_center",
    "sports_soccer",
    "park",
    "local_florist",
    "spa",
    "beach_access",
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

const getIconName = (key?: string | null) => {
  if (!key) return "folder";
  return (iconAlias as any)[key] || key;
};

const iconMenuVisible = ref(false);
const gmIconPreview = ref<HTMLElement | null>(null);
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

function toggleColorMenu() {
  textMenuVisible.value = false;
  iconMenuVisible.value = false;
  colorCustomMode.value = false;
  menuVisible.value = !menuVisible.value;
}

function toggleTextColorMenu() {
  menuVisible.value = false;
  iconMenuVisible.value = false;
  textColorCustomMode.value = false;
  textMenuVisible.value = !textMenuVisible.value;
}

function toggleIconMenu() {
  menuVisible.value = false;
  textMenuVisible.value = false;
  iconMenuVisible.value = !iconMenuVisible.value;
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
      localLocalName.value = "";
      localParent.value = props.initialParentId ? String(props.initialParentId) : null;
      localColor.value = GROUP_DEFAULT_BACKGROUND;
      localIcon.value = "folder";
      localShareSubgroups.value = false;
      localHideTasksInParent.value = false;
      localShortcut.value = false;
      localTextColor.value = GROUP_DEFAULT_TEXT_COLOR;
      localBackgroundImage.value = null;
      localLayoutColorize.value = false;
      localBgColorize.value = true;
      localCalendarColorize.value = true;
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
          const listAny: any = CC.group.list?.all;
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
        localLocalName.value = getLocalGroupName(String(id));
        localParent.value = src.parentId || src.parent_id || null;
        localColor.value = src.color || GROUP_DEFAULT_BACKGROUND;
        localTextColor.value = src.textColor || src.text_color || localTextColor.value;
        localIcon.value = src.icon || "folder";
        localShareSubgroups.value = Boolean(src.shareSubgroups);
        localHideTasksInParent.value = Boolean(src.hideTasksFromParent);
        localShortcut.value = Boolean(src.shortcut);
        const bg = readGroupBackgroundFields(src);
        localLayoutColorize.value = bg.layoutColorize;
        localBgColorize.value = bg.backgroundColorize;
        localCalendarColorize.value = bg.calendarColorize;
        void resolveGroupBackgroundDisplayUrl(bg.backgroundImage).then((url) => {
          localBackgroundImage.value = url;
        });
      }
    } catch (e) {
      void e;
    }
  },
  { immediate: true }
);

function pickBackgroundImage() {
  bgImageInput.value?.click();
}

function clearBackgroundImage() {
  localBackgroundImage.value = null;
  localLayoutColorize.value = false;
  localBgColorize.value = false;
  localCalendarColorize.value = false;
  if (bgImageInput.value) bgImageInput.value.value = "";
}

watch(localLayoutColorize, (on, prev) => {
  if (!on) {
    localBgColorize.value = false;
    localCalendarColorize.value = false;
  } else if (!prev) {
    localBgColorize.value = true;
    localCalendarColorize.value = true;
  }
});

function onBackgroundImageSelected(ev: Event) {
  const input = ev.target as HTMLInputElement | null;
  const file = input?.files?.[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    appNotify("warning", "Please choose an image file.");
    return;
  }
  if (file.size > MAX_GROUP_BG_BYTES) {
    appNotify("warning", "Image is too large (max 5 MB).");
    if (input) input.value = "";
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    const data = typeof reader.result === "string" ? reader.result : null;
    if (data) localBackgroundImage.value = data;
  };
  reader.onerror = () => appNotify("negative", "Could not read image.");
  reader.readAsDataURL(file);
}

function openColorCustomPanel() {
  draftColor.value = localColor.value || GROUP_DEFAULT_BACKGROUND;
  colorCustomMode.value = true;
}

function confirmColorCustom() {
  localColor.value = draftColor.value;
  colorCustomMode.value = false;
  menuVisible.value = false;
}

function cancelColorCustom() {
  colorCustomMode.value = false;
}

function resetColor() {
  localColor.value = GROUP_DEFAULT_BACKGROUND;
  menuVisible.value = false;
}

function openTextColorCustomPanel() {
  draftTextColor.value = localTextColor.value || GROUP_DEFAULT_TEXT_COLOR;
  textColorCustomMode.value = true;
}

function confirmTextColorCustom() {
  localTextColor.value = draftTextColor.value;
  textColorCustomMode.value = false;
  textMenuVisible.value = false;
}

function cancelTextColorCustom() {
  textColorCustomMode.value = false;
}

function resetTextColor() {
  localTextColor.value = GROUP_DEFAULT_TEXT_COLOR;
  textMenuVisible.value = false;
}

function selectTextPaletteColor(c: string) {
  localTextColor.value = c;
  textMenuVisible.value = false;
}

function selectPaletteColor(c: string) {
  localColor.value = c;
  menuVisible.value = false;
}

function onSubmit() {
  const payload = {
    name: localName.value.trim(),
    localName: localLocalName.value.trim(),
    parent: localParent.value || undefined,
    color: localColor.value,
    textColor: localTextColor.value,
    icon: localIcon.value,
    shareSubgroups: localShareSubgroups.value,
    hideTasksFromParent: localHideTasksInParent.value,
    shortcut: localShortcut.value,
    backgroundImage: localBackgroundImage.value || null,
    layoutColorize: localLayoutColorize.value,
    backgroundColorize: localLayoutColorize.value && localBgColorize.value,
    calendarColorize: localLayoutColorize.value && localCalendarColorize.value,
  };
  if (!payload.name) return;
  emit("submit", payload);
}
function onCancel() {
  emit("cancel");
}
</script>

<style scoped>
:deep(.gm-controls .q-icon),
:deep(.gm-controls .q-icon *),
:deep(.gm-icon-item .q-icon),
:deep(.gm-icon-item .q-icon *) {
  color: rgba(0, 0, 0, 0.87) !important;
  fill: rgba(0, 0, 0, 0.87) !important;
  -webkit-text-fill-color: rgba(0, 0, 0, 0.87) !important;
}

/* Ensure icons inside the larger selector tiles scale up */
:deep(.gm-icon-item .q-icon),
:deep(.gm-icon-item .q-icon *) {
  font-size: 22px !important;
  width: 22px !important;
  height: 22px !important;
  line-height: 22px !important;
}

/* Preview icon slightly smaller than tiles */
:deep(.gm-icon-preview .q-icon),
:deep(.gm-icon-preview .q-icon *) {
  font-size: 24px !important;
  width: 24px !important;
  height: 24px !important;
  line-height: 24px !important;
}

/* Allow the preview to use the chosen text color (via CSS variable) */
.gm-icon-preview {
  --gm-text-color: #ffffff;
}
:deep(.gm-icon-preview .q-icon),
:deep(.gm-icon-preview .q-icon *) {
  color: var(--gm-text-color) !important;
  fill: var(--gm-text-color) !important;
  -webkit-text-fill-color: var(--gm-text-color) !important;
}

/* Reduce right padding inside the color/text-color inputs */
:deep(.gm-color-field .q-field__control) {
  padding-right: 6px !important;
}
:deep(.gm-color-field .q-field__append) {
  margin-left: 6px !important;
}

/* content-class for parent menu to ensure it stacks above overlays */
.gm-parent-menu-content {
  z-index: 12000 !important;
}

:deep(.gm-color-field.q-field--outlined .q-field__control) {
  overflow: visible !important;
}

.gm-color-swatch-trigger {
  width: 30px;
  height: 30px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.9);
  cursor: pointer;
  box-sizing: border-box;
  flex-shrink: 0;
}

.gm-color-swatch-trigger--text {
  border-color: rgba(0, 0, 0, 0.12);
}

.gm-bg-preview {
  position: relative;
  width: 88px;
  height: 52px;
  margin-left: auto;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.35);
  flex-shrink: 0;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.15);
  overflow: hidden;
}

.gm-bg-preview__photo,
.gm-bg-preview__wash {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
}

.gm-bg-preview__wash {
  pointer-events: none;
}

.gm-bg-row {
  flex-wrap: wrap;
}

</style>

<style lang="scss">
/* Unscoped: q-menu content is teleported outside the component */
.gm-popup-menu {
  z-index: 2147483540 !important;
}

.gm-color-palette-menu {
  overflow: visible !important;
  z-index: 2147483540 !important;
}

.gm-color-custom-panel {
  box-sizing: border-box;
  min-width: 280px;
  max-width: min(340px, 92vw);
  padding: 10px 12px 12px;
}

.gm-q-color-picker {
  width: 100%;
  max-width: 316px;
}

.gm-color-custom-panel__below {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  width: 100%;
}

.gm-color-custom-preview {
  flex: 1 1 0;
  min-width: 0;
  width: 50%;
  max-width: 50%;
  height: 36px;
  border-radius: 6px;
  border: 1px solid rgba(0, 0, 0, 0.2);
  box-sizing: border-box;
}

.gm-color-custom-hex {
  flex: 1 1 0;
  min-width: 0;
  width: 50%;
  max-width: 50%;
}

.gm-color-palette {
  box-sizing: border-box;
  min-width: 300px;
  max-width: min(360px, 92vw);
  padding: 10px 12px 12px;
}

.gm-color-palette--text {
  min-width: 240px;
  max-width: min(280px, 92vw);
}

.gm-color-palette__grid {
  display: grid;
  grid-template-columns: repeat(8, 32px);
  gap: 8px;
  justify-content: start;
}

.gm-color-palette__grid--text {
  grid-template-columns: repeat(6, 32px);
}

.gm-color-palette__swatch {
  width: 32px;
  height: 32px;
  padding: 0;
  border-radius: 6px;
  border: 2px solid rgba(0, 0, 0, 0.15);
  cursor: pointer;
  box-sizing: border-box;
}

.gm-color-palette__swatch--selected {
  border-color: #fff;
  outline: 2px solid rgba(0, 0, 0, 0.55);
  outline-offset: 1px;
}

.gm-color-palette__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid rgba(0, 0, 0, 0.12);
}

.gm-color-palette__action-btn .q-btn__content {
  gap: 8px;
}

.gm-color-palette__action-preview {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  border: 1px solid rgba(0, 0, 0, 0.2);
  flex-shrink: 0;
}

.gm-color-palette__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid rgba(0, 0, 0, 0.12);
}

.gm-icon-picker-panel {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  max-width: 320px;
  padding: 8px;
}
</style>
