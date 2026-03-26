<template>
  <q-dialog v-model="dialogVisible">
    <q-card style="min-width: 640px; max-width: 820px">
      <q-card-section>
        <div class="text-h6">{{ $text('ui.join_device') }}</div>
      </q-card-section>

      <q-card-section class="q-pt-none" style="display: flex; gap: 24px; align-items: flex-start">
        <!-- Left: group tree -->
        <div style="flex: 0 0 260px">
          <div class="text-subtitle2 q-mb-sm">{{ $text('ui.select_group') }}</div>
          <div style="max-height: 52vh; overflow: auto; border: 1px solid rgba(0,0,0,0.12); border-radius: 6px; padding: 4px">
            <q-tree
              :nodes="treeNodes"
              node-key="id"
              default-expand-all
              :selected="selectedGroupId ?? undefined"
              @update:selected="onGroupSelect"
            >
              <template #default-header="{ node }">
                <div class="row items-center">
                  <q-icon :name="node.icon || 'folder'" :style="{ color: node.color }" class="q-mr-sm" />
                  <span>{{ node.label }}</span>
                </div>
              </template>
            </q-tree>
          </div>
        </div>

        <!-- Right: roles for selected group -->
        <div style="flex: 1; min-width: 0">
          <div class="row items-center q-mb-sm" style="gap: 8px">
            <span class="text-subtitle2">{{ $text('role.roles_for_group') }}</span>
            <q-space />
            <q-btn
              dense
              unelevated
              color="primary"
              icon="add"
              :label="$text('role.create_role')"
              size="sm"
              :disable="!selectedGroupId"
              @click="openCreateRole"
            />
          </div>

          <div v-if="!selectedGroupId" class="text-grey-6 text-caption">
            {{ $text('role.select_group_first') }}
          </div>
          <div v-else-if="rolesForGroup.length === 0" class="text-grey-6 text-caption">
            {{ $text('role.no_roles') }}
          </div>
          <q-list v-else bordered separator style="border-radius: 6px">
            <q-item v-for="role in rolesForGroup" :key="role.id">
              <q-item-section>
                <q-item-label>{{ role.name }}</q-item-label>
                <q-item-label caption>
                  {{ $text('role.access_range') }}: {{ $text('role.range_' + role.accessRange) }}
                  &nbsp;·&nbsp;
                  {{ $text('role.privilege') }}: {{ $text('role.priv_' + role.privilege) }}
                </q-item-label>
              </q-item-section>
              <q-item-section side>
                <div style="display: flex; gap: 4px">
                  <q-btn flat dense round icon="edit" size="sm" @click="openEditRole(role)" />
                  <q-btn flat dense round icon="delete" size="sm" color="negative" @click="onDeleteRole(role.id)" />
                </div>
              </q-item-section>
            </q-item>
          </q-list>
        </div>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat :label="$text('action.close')" @click="dialogVisible = false" />
      </q-card-actions>
    </q-card>
  </q-dialog>

  <RoleEditDialog
    v-model="showRoleEdit"
    :editing-id="editingRoleId"
    :initial-name="editingRole?.name ?? null"
    :initial-access-range="editingRole?.accessRange ?? null"
    :initial-privilege="editingRole?.privilege ?? null"
    @save="onRoleSave"
  />
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { $text } from 'src/modules/lang';
import CC from 'src/CentralController';
import { Role } from 'src/modules/storage/sync/RoleModel';
import type { RoleData, AccessRange, RolePrivilege } from 'src/modules/storage/sync/RoleModel';
import RoleEditDialog from './RoleEditDialog.vue';
import { saveData } from 'src/utils/storageUtils';

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
}>();

const dialogVisible = computed({
  get: () => !!props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
});

// ── Group tree ───────────────────────────────────────────────────────────────

const selectedGroupId = ref<string | null>(null);

// Auto-select active group when dialog opens
watch(
  () => props.modelValue,
  (open) => {
    if (!open) return;
    try {
      const active = CC.group.active.activeGroup.value;
      if (!active) { selectedGroupId.value = null; return; }
      if (typeof active === 'string' || typeof active === 'number') {
        selectedGroupId.value = String(active);
      } else {
        const a = active as Record<string, unknown>;
        const raw = a.value ?? a.id ?? null;
        const prim = typeof raw === 'string' || typeof raw === 'number' ? raw : null;
        selectedGroupId.value = prim != null ? String(prim) : null;
      }
    } catch {
      selectedGroupId.value = null;
    }
  },
);

function convertNode(n: any): any {
  return {
    id: String(n.id),
    label: n.name || n.label || String(n.id),
    icon: n.icon || 'folder',
    color: n.color || null,
    children: (n.children || []).map(convertNode),
  };
}

const treeNodes = computed(() => {
  try {
    return (CC.group.list.tree.value ?? []).map(convertNode);
  } catch {
    return [];
  }
});

function onGroupSelect(val: any) {
  const key = Array.isArray(val) ? val[0] : val;
  selectedGroupId.value = key ? String(key) : null;
}

// ── Roles (read directly from group, saved via CC.group.update) ──────────────

/** Current roles stored on the selected group. */
const rolesForGroup = computed<RoleData[]>(() => {
  if (!selectedGroupId.value) return [];
  const g = (CC.group.list.all.value as any[]).find(
    (x) => String(x.id) === selectedGroupId.value,
  );
  return (g?.roles as RoleData[] | undefined) ?? [];
});

async function saveRoles(roles: RoleData[]) {
  if (!selectedGroupId.value) return;
  if (typeof CC.group.update === 'function') {
    await CC.group.update(selectedGroupId.value, { roles });
  } else {
    const list: any[] = CC.group.list.all.value ?? [];
    const found = list.find((g: any) => String(g.id) === selectedGroupId.value);
    if (found) {
      found.roles = roles;
      await saveData();
    }
  }
}

// ── Role edit dialog ──────────────────────────────────────────────────────

const showRoleEdit = ref(false);
const editingRoleId = ref<string | null>(null);
const editingRole = ref<RoleData | null>(null);

function openCreateRole() {
  editingRoleId.value = null;
  editingRole.value = null;
  showRoleEdit.value = true;
}

function openEditRole(role: RoleData) {
  editingRoleId.value = role.id;
  editingRole.value = role;
  showRoleEdit.value = true;
}

async function onRoleSave(payload: { name: string; accessRange: AccessRange; privilege: RolePrivilege }) {
  const current = [...rolesForGroup.value];
  if (editingRoleId.value) {
    const idx = current.findIndex((r) => r.id === editingRoleId.value);
    if (idx >= 0) {
      current[idx] = { ...current[idx]!, ...payload, updatedAt: Date.now() };
    }
  } else {
    const newRole = Role.create(payload.name, selectedGroupId.value, payload.accessRange, payload.privilege);
    current.push(newRole.toJSON());
  }
  await saveRoles(current);
}

async function onDeleteRole(id: string) {
  await saveRoles(rolesForGroup.value.filter((r) => r.id !== id));
}
</script>
