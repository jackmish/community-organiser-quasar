<template>
  <q-dialog v-model="dialogVisible">
    <q-card style="min-width: 720px; max-width: 900px">
      <q-card-section>
        <div class="row items-center" style="gap: 12px">
          <div class="text-h6">Manage Groups</div>
          <div style="margin-left: auto; display: flex; gap: 6px; align-items: center">
            Privilage Mode:
            <q-btn
              dense
              :flat="privilegeMode !== 'preview'"
              :unelevated="privilegeMode === 'preview'"
              label="Preview"
              @click.prevent="privilegeMode = 'preview'"
              class="mode-btn"
              :class="{ active: privilegeMode === 'preview' }"
            />
            <q-btn
              dense
              :flat="privilegeMode !== 'edit'"
              :unelevated="privilegeMode === 'edit'"
              label="Edit"
              @click.prevent="privilegeMode = 'edit'"
              class="mode-btn"
              :class="{ active: privilegeMode === 'edit' }"
            />
            <q-btn
              dense
              :flat="privilegeMode !== 'remove'"
              :unelevated="privilegeMode === 'remove'"
              label="Remove"
              @click.prevent="privilegeMode = 'remove'"
              class="mode-btn"
              :class="{ active: privilegeMode === 'remove' }"
            />
          </div>
        </div>

        <q-card-section class="q-pt-sm">
          <q-form v-if="privilegeMode === 'edit'" @submit.prevent="onAddGroup" class="q-mb-md">
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
                    <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{{
                      parentLabel
                    }}</span>
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
                        <q-item-section avatar style="min-width: 36px">
                          <q-icon name="folder_open" />
                        </q-item-section>
                        <q-item-section>None (no parent)</q-item-section>
                      </q-item>
                    </q-list>

                    <q-separator />

                    <div style="max-height: 44vh; overflow: auto; padding-top: 6px">
                      <q-tree
                        :nodes="groupTree"
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
              </div>

              <div style="display: flex; align-items: center; gap: 8px; margin-left: 4px">
                <q-checkbox v-model="localShareSubgroups" label="Share subgroups" dense />
              </div>

              <div style="display: flex; align-items: center; gap: 8px; margin-left: 4px">
                <q-checkbox v-model="localHideTasksInParent" label="Hide tasks from parent" dense />
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
                          style="display: flex; align-items: center; gap: 8px; padding: 6px 10px"
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

              <div style="display: flex; gap: 8px; align-items: center">
                <q-btn v-if="!editingGroupId" type="submit" color="primary" icon="add" dense />
                <q-btn v-else type="submit" color="primary" icon="save" dense />
                <q-btn
                  v-if="editingGroupId"
                  flat
                  label="Cancel"
                  color="primary"
                  @click.prevent="cancelEdit"
                />
              </div>
            </div>
          </q-form>
        </q-card-section>

        <q-tree :nodes="groupTree" node-key="id" default-expand-all>
          <template #default-header="prop">
            <div class="row items-center full-width">
              <q-icon
                :name="getIconName(prop.node.icon)"
                class="q-mr-sm"
                :style="{ color: prop.node.color }"
              />
              <span>{{ prop.node.label }}</span>
              <q-space />
              <q-btn
                v-if="privilegeMode !== 'preview'"
                flat
                dense
                round
                icon="edit"
                size="sm"
                @click.stop.prevent="startEdit(prop.node)"
                class="q-mr-sm"
              />

              <div style="display: flex; gap: 6px; align-items: center">
                <template v-if="privilegeMode === 'remove' && pendingDeleteId === prop.node.id">
                  <q-btn
                    dense
                    color="negative"
                    flat
                    label="Confirm"
                    size="sm"
                    @click.stop.prevent="confirmDelete(prop.node.id)"
                  />
                  <q-btn
                    dense
                    flat
                    label="Cancel"
                    size="sm"
                    @click.stop.prevent="cancelPendingDelete"
                  />
                </template>
                <template v-else-if="privilegeMode === 'remove'">
                  <q-btn
                    flat
                    dense
                    round
                    icon="delete"
                    size="sm"
                    @click.stop.prevent="markPendingDelete(prop.node.id)"
                  />
                </template>
                <template v-else>
                  <!-- no delete controls in preview/edit modes -->
                </template>
              </div>
            </div>
          </template>
        </q-tree>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Close" color="primary" @click="close" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import logger from 'src/utils/logger';
import { typeIcons, priorityIcons } from './theme';

import { useDayOrganiser } from '../modules/day-organiser';

const props = defineProps<{
  modelValue: boolean;
  groupOptions: any[];
  groupTree: any[];
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
  (e: 'add-group', payload: { name: string; parent?: string; color?: string; icon?: string }): void;
  (e: 'delete-group', id: string): void;
}>();

const localName = ref('');
const localParent = ref<string | null>(null);
const parentMenuOpen = ref(false);
const localParentIcon = ref<string | null>(null);
const localParentColor = ref<string | null>(null);
const localColor = ref('#1976d2');
const localIcon = ref<string | null>('folder');
const localShareSubgroups = ref(false);
const localHideTasksInParent = ref(false);
const pendingDeleteId = ref<string | null>(null);
const privilegeMode = ref<'preview' | 'edit' | 'remove'>('edit');
const colorInput = ref<HTMLInputElement | null>(null);
const menuVisible = ref(false);
const paletteColors = [
  '#1976d2',
  '#e91e63',
  '#9c27b0',
  '#ff9800',
  '#4caf50',
  '#f44336',
  '#795548',
  '#607d8b',
  '#ffffff',
  '#000000',
];
const paletteBtn = ref<HTMLElement | undefined>(undefined);
const iconMenuVisible = ref(false);
const gmIconPreview = ref<HTMLElement | null>(null);
const iconMenuStyle = ref<Record<string, string>>({ position: 'fixed', left: '0px', top: '0px' });
const iconOptions = (() => {
  const set = new Set<string>();
  try {
    Object.values(typeIcons || {}).forEach((i) => i && set.add(i));
  } catch (e) {
    void e;
  }
  try {
    Object.values(priorityIcons || {}).forEach((i) => i && set.add(i));
  } catch (e) {
    void e;
  }
  ['folder', 'label', 'group', 'account_circle', 'bookmarks'].forEach((i) => set.add(i));
  // Add requested locality icons and common equivalents
  ['house', 'skyscraper', 'factory', 'tree', 'car', 'truck', 'road'].forEach((i) => set.add(i));
  return Array.from(set);
})();

// Map friendly keys to available Material icon names (fallback to key if not mapped)
const iconAlias: Record<string, string> = {
  house: 'home',
  skyscraper: 'location_city',
  factory: 'factory',
  tree: 'park',
  car: 'directions_car',
  truck: 'local_shipping',
  road: 'alt_route',
};

function getIconName(key?: string | null) {
  if (!key) return 'folder';
  return (iconAlias as any)[key] || key;
}

function toggleIconMenu() {
  try {
    if (iconMenuVisible.value) {
      iconMenuVisible.value = false;
      return;
    }
    // compute position near the preview element and open fixed-position menu
    const el = gmIconPreview.value;
    if (!el) {
      iconMenuVisible.value = true;
      return;
    }
    const r = el.getBoundingClientRect();
    const left = Math.min(window.innerWidth - 340, r.right - 44);
    const top = Math.min(window.innerHeight - 200, r.bottom + 6);
    iconMenuStyle.value = {
      position: 'fixed',
      left: `${left}px`,
      top: `${top}px`,
    };
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
  localIcon.value = 'folder';
  iconMenuVisible.value = false;
}

function onParentTreeSelect(val: any) {
  const key = Array.isArray(val) ? val[0] : val;
  if (!key) return;
  localParent.value = String(key);
  // try to populate preview icon/color if available in groupTree
  try {
    const findNode = (nodes: any[]): any => {
      for (const n of nodes || []) {
        if (String(n.id) === String(key)) return n;
        const f = findNode(n.children || []);
        if (f) return f;
      }
      return null;
    };
    const node = findNode(props.groupTree || []);
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

// Normalize various parentId shapes to a string id or null
const normalizeParent = (v: any): string | null => {
  if (v == null) return null;
  if (typeof v === 'object') {
    const maybe = v.value ?? v.id ?? null;
    return maybe == null ? null : String(maybe);
  }
  return String(v);
};

watch(
  () => parentMenuOpen.value,
  (open) => {
    try {
      if (open) {
        const rootIds = (props.groupTree || []).map((n: any) => n.id).slice(0, 10);
        logger.debug(
          '[GroupManagementDialog] parentMenuOpen opened, groupTree.length=',
          (props.groupTree || []).length,
          'rootIds=',
          rootIds,
          'localParent=',
          localParent.value,
        );
      }
    } catch (e) {
      void e;
    }
  },
);

// Clear/adjust UI state when switching privilege mode
watch(
  () => privilegeMode.value,
  (m) => {
    try {
      if (m !== 'remove') pendingDeleteId.value = null;
      if (m !== 'edit') {
        // hide creation/edit state when not in edit mode
        editingGroupId.value = null;
        localName.value = '';
        localParent.value = null;
      }
    } catch (e) {
      void e;
    }
  },
);

const dialogVisible = computed({
  get: () => !!props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
});

const editingGroupId = ref<string | null>(null);

const parentLabel = computed(() => {
  if (!localParent.value) return 'Parent Group (optional)';
  try {
    const findNode = (nodes: any[]): any => {
      for (const n of nodes || []) {
        if (String(n.id) === String(localParent.value)) return n;
        const f = findNode(n.children || []);
        if (f) return f;
      }
      return null;
    };
    const node = findNode(props.groupTree || []);
    if (node) return node.label || String(localParent.value);
  } catch (e) {
    void e;
  }
  const opt = (props.groupOptions || []).find(
    (o: any) => String(o.value) === String(localParent.value),
  );
  return opt?.label || String(localParent.value);
});

const findNodeInTree = (nodes: any[], key: string): any => {
  for (const n of nodes || []) {
    if (String(n.id) === String(key)) return n;
    const f = findNodeInTree(n.children || [], key);
    if (f) return f;
  }
  return null;
};

watch(
  () => localParent.value,
  (v) => {
    try {
      if (!v) {
        localParentIcon.value = null;
        localParentColor.value = null;
        return;
      }
      const node = findNodeInTree(props.groupTree || [], String(v));
      if (node) {
        localParentIcon.value = node.icon || null;
        localParentColor.value = node.color || null;
      }
    } catch (e) {
      void e;
    }
  },
  { immediate: true },
);

watch(
  () => props.modelValue,
  (v) => {
    if (v) {
      localName.value = '';
      localParent.value = null;
      localColor.value = '#1976d2';
      localIcon.value = 'folder';
      localShareSubgroups.value = false;
      localHideTasksInParent.value = false;
    }
  },
);

async function onAddGroup() {
  if (!localName.value.trim()) return;
  const name = localName.value.trim();
  const color = localColor.value;
  const icon = localIcon.value || undefined;
  const parent = localParent.value || undefined;

  try {
    const { addGroup, updateGroup } = useDayOrganiser();
    if (editingGroupId.value) {
      // update existing
      await updateGroup(editingGroupId.value, {
        name,
        ...(parent ? { parentId: parent } : {}),
        ...(color ? { color } : {}),
        ...(icon ? { icon } : {}),
        ...(typeof localShareSubgroups.value === 'boolean'
          ? { shareSubgroups: localShareSubgroups.value }
          : {}),
        ...(typeof localHideTasksInParent.value === 'boolean'
          ? { hideTasksFromParent: localHideTasksInParent.value }
          : {}),
      });
    } else {
      // add new
      await addGroup({
        name,
        parentId: parent,
        color,
        icon: icon as any,
        shareSubgroups: localShareSubgroups.value,
        hideTasksFromParent: localHideTasksInParent.value,
      });
    }
  } catch (e) {
    logger.error('add/update group failed', e);
  }

  // reset form and exit edit mode
  localName.value = '';
  localParent.value = null;
  localColor.value = '#1976d2';
  localIcon.value = 'folder';
  localShareSubgroups.value = false;
  localHideTasksInParent.value = false;
  editingGroupId.value = null;
  // keep dialog open so user can add or edit more groups without reopening
}

async function onDeleteGroup(id: string) {
  try {
    const { deleteGroup } = useDayOrganiser();
    await deleteGroup(id);
    if (editingGroupId.value === id) cancelEdit();
  } catch (e) {
    logger.error('deleteGroup failed', e);
  }
}

function markPendingDelete(id: string) {
  pendingDeleteId.value = id;
  // auto-clear pending state after a short timeout
  setTimeout(() => {
    if (pendingDeleteId.value === id) pendingDeleteId.value = null;
  }, 6000);
}

function cancelPendingDelete() {
  pendingDeleteId.value = null;
}

async function confirmDelete(id: string) {
  try {
    await onDeleteGroup(id);
  } catch (e) {
    void e;
  } finally {
    pendingDeleteId.value = null;
  }
}

function startEdit(node: any) {
  try {
    const { groups } = useDayOrganiser();
    // Helper: accept either an array or a ref/computed that holds an array
    function unwrapArray(maybe: unknown): any[] {
      if (Array.isArray(maybe)) return maybe;
      if (maybe && typeof maybe === 'object' && Array.isArray((maybe as any).value))
        return (maybe as any).value;
      return [];
    }
    // `groups` is a computed ref; access `.value` to get the underlying array
    const grpList = unwrapArray(groups);
    const g = grpList.find((x: any) => x.id === node.id);
    editingGroupId.value = node.id;
    localName.value = g?.name || node.label || node.name || '';
    // normalize stored parent to a plain id string (or null)
    localParent.value = normalizeParent(
      g?.parentId ??
        g?.parent_id ??
        node.parentId ??
        (node.group && (node.group.parentId ?? node.group.parent_id)) ??
        null,
    );
    localColor.value = g?.color || node.color || '#1976d2';
    localIcon.value = g?.icon || node.icon || 'folder';
    localShareSubgroups.value = Boolean(g?.shareSubgroups);
    localHideTasksInParent.value = Boolean(g?.hideTasksFromParent);
    // populate parent preview icon/color
    try {
      const p = localParent.value;
      if (p) {
        const found = findNodeInTree(props.groupTree || [], String(p));
        if (found) {
          localParentIcon.value = found.icon || null;
          localParentColor.value = found.color || null;
        }
      }
    } catch (e) {
      void e;
    }
    // open dialog in same view (it is already open)
  } catch (e) {
    logger.error('startEdit failed', e);
  }
}

function cancelEdit() {
  editingGroupId.value = null;
  localName.value = '';
  localParent.value = null;
  localColor.value = '#1976d2';
  localIcon.value = 'folder';
}

function onColorInput(e: Event) {
  try {
    const target = e.target as HTMLInputElement | null;
    if (target && typeof target.value === 'string') {
      localColor.value = target.value;
    }
  } catch (err) {
    void err;
  }
}

function openColorPicker() {
  try {
    logger.debug('GroupManagementDialog: openColorPicker called');

    if (colorInput.value) {
      logger.debug('Using in-dialog color input (will clone and click)');

      try {
        const orig = colorInput.value;
        const clone = orig.cloneNode(true) as HTMLInputElement;
        clone.value = orig.value || localColor.value || '#1976d2';
        clone.style.position = 'fixed';
        clone.style.width = '1px';
        clone.style.height = '1px';
        clone.style.opacity = '0';
        clone.style.pointerEvents = 'auto';

        // position clone near the original input so native picker opens nearby
        try {
          const rect = orig.getBoundingClientRect();
          const left = Math.max(0, rect.left + window.scrollX + 4);
          const top = Math.max(0, rect.bottom + window.scrollY + 4);
          clone.style.left = `${left}px`;
          clone.style.top = `${top}px`;
        } catch (err) {
          clone.style.left = '0px';
          clone.style.top = '0px';
        }

        document.body.appendChild(clone);

        const onInputClone = (e: Event) => {
          const t = e.target as HTMLInputElement | null;
          logger.debug('clone color input event', { type: e.type, value: t?.value });
          if (t && typeof t.value === 'string') localColor.value = t.value;
        };

        clone.addEventListener('input', onInputClone);
        clone.addEventListener('change', onInputClone);

        setTimeout(() => {
          try {
            clone.click();
          } catch (e) {
            logger.error('clone.click failed', e);
          }
        }, 50);

        setTimeout(() => {
          clone.removeEventListener('input', onInputClone);
          clone.removeEventListener('change', onInputClone);
          if (clone.parentElement) clone.parentElement.removeChild(clone);
          logger.debug('clone removed');
        }, 5000);
      } catch (e) {
        logger.error('clone path failed', e);
      }

      return;
    }

    const temp = document.createElement('input');
    temp.type = 'color';
    temp.value = localColor.value || '#1976d2';
    temp.style.position = 'fixed';
    temp.style.left = '0';
    temp.style.top = '0';
    temp.style.width = '1px';
    temp.style.height = '1px';
    temp.style.opacity = '0';
    temp.style.pointerEvents = 'auto';
    document.body.appendChild(temp);

    const onInput = (e: Event) => {
      const t = e.target as HTMLInputElement | null;
      logger.debug('ephemeral color input event', { type: e.type, value: t?.value });
      if (t && typeof t.value === 'string') {
        localColor.value = t.value;
      }
    };

    const onClick = () => logger.debug('ephemeral input clicked');
    const onFocus = () => logger.debug('ephemeral input focused');
    const onBlur = () => logger.debug('ephemeral input blurred');

    temp.addEventListener('input', onInput);
    temp.addEventListener('change', onInput);
    temp.addEventListener('click', onClick);
    temp.addEventListener('focus', onFocus);
    temp.addEventListener('blur', onBlur);

    // ensure it's in DOM before clicking
    setTimeout(() => {
      try {
        logger.debug('Attempting temp.click()');
        temp.click();
      } catch (e) {
        logger.error('temp.click failed', e);
      }
    }, 50);

    setTimeout(() => {
      temp.removeEventListener('input', onInput);
      temp.removeEventListener('change', onInput);
      temp.removeEventListener('click', onClick);
      temp.removeEventListener('focus', onFocus);
      temp.removeEventListener('blur', onBlur);
      if (temp.parentElement) temp.parentElement.removeChild(temp);
      logger.debug('ephemeral input removed');
    }, 5000);
  } catch (err) {
    logger.error('openColorPicker failed', err);
  }
}

function selectPaletteColor(c: string) {
  try {
    localColor.value = c;
    menuVisible.value = false;
    logger.debug('selectPaletteColor', c);
  } catch (err) {
    void err;
  }
}

function resetColor() {
  try {
    localColor.value = '#1976d2';
    menuVisible.value = false;
    logger.debug('resetColor to default');
  } catch (err) {
    void err;
  }
}

function openCustom() {
  try {
    menuVisible.value = false;
    // allow menu to close visually before opening native picker
    setTimeout(() => openColorPicker(), 120);
  } catch (err) {
    void err;
  }
}

function close() {
  dialogVisible.value = false;
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

/* Mode buttons: ensure active one has visible background */
.mode-btn {
  border-radius: 4px;
  padding: 4px 8px;
  background-color: #246 !important;
  &.active {
    background-color: #222 !important;
    color: #fff !important;
  }
}
</style>
