<template>
  <q-dialog v-model="dialogVisible" v-bind="dialogBind">
    <q-card :class="cardClass" :style="cardStyle">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">{{ $text('role.setup_title') }}</div>
        <q-space />
        <q-btn flat round dense icon="close" @click="dialogVisible = false" />
      </q-card-section>

      <q-card-section class="text-caption text-grey-7 q-pt-xs">
        {{ $text('role.setup_intro') }}
      </q-card-section>

      <q-card-section
        :class="['row q-col-gutter-md q-pt-none', bodyClass]"
        :style="bodyStyle"
      >
        <div class="col-12 col-md-3 column" :style="isMobile ? { maxHeight: '32vh' } : { minHeight: '200px' }">
          <div class="row items-center q-mb-sm q-gutter-xs">
            <span class="text-subtitle2">{{ $text('role.roles_list') }}</span>
            <q-space />
            <q-btn
              dense
              unelevated
              color="primary"
              icon="add"
              :label="$text('role.new_role')"
              size="sm"
              @click="addRole"
            />
          </div>
          <q-list bordered separator class="rounded-borders col" style="overflow: auto">
            <q-item
              v-for="role in profiles"
              :key="role.id"
              clickable
              v-ripple
              :active="selectedRoleId === role.id"
              active-class="bg-primary text-white"
              @click="selectRole(role.id)"
            >
              <q-item-section>{{ displayRoleName(role) }}</q-item-section>
              <q-item-section side>
                <q-btn
                  flat
                  dense
                  round
                  icon="delete"
                  size="sm"
                  :color="selectedRoleId === role.id ? 'white' : 'negative'"
                  @click.stop="deleteRole(role.id)"
                />
              </q-item-section>
            </q-item>
            <q-item v-if="!profiles.length">
              <q-item-section class="text-grey-6 text-caption">
                {{ $text('role.no_roles_defined') }}
              </q-item-section>
            </q-item>
          </q-list>
        </div>

        <div class="col-12 col-md-9 column" style="min-height: 0">
          <template v-if="editing">
            <q-input
              ref="roleNameInputRef"
              :model-value="roleNameInput"
              :label="$text('role.name')"
              outlined
              dense
              class="q-mb-md"
              @update:model-value="onRoleNameInput"
            />

            <div class="text-subtitle2 q-mb-xs">{{ $text('role.group_assignment_range') }}</div>
            <div class="text-caption text-grey-7 q-mb-sm">
              {{ $text('role.group_assignment_range_hint') }}
            </div>
            <q-option-group
              :model-value="editing.accessRange"
              :options="rangeOptions"
              type="radio"
              inline
              dense
              class="q-mb-md"
              @update:model-value="(v) => setAccessRange(v as AccessRange)"
            />

            <div class="text-subtitle2 q-mb-xs">{{ $text('role.function_access_matrix') }}</div>
            <div class="text-caption text-grey-7 q-mb-sm">
              {{ $text('role.function_access_hint') }}
            </div>

            <div
              class="rounded-borders col"
              style="overflow: auto; border: 1px solid rgba(0, 0, 0, 0.12)"
            >
              <q-markup-table dense flat separator="horizontal" class="role-access-table">
                <thead>
                  <tr class="bg-grey-2">
                    <th class="text-left" style="width: 48px">{{ $text('role.col_enabled') }}</th>
                    <th class="text-left">{{ $text('role.col_function') }}</th>
                    <th class="text-left">{{ $text('role.privilege') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in functionRows" :key="row.id">
                    <td>
                      <q-checkbox
                        :model-value="ruleFor(row.id).enabled"
                        dense
                        @update:model-value="(v) => setRuleEnabled(row.id, !!v)"
                      />
                    </td>
                    <td>{{ row.label }}</td>
                    <td>
                      <q-option-group
                        :model-value="ruleFor(row.id).privilege"
                        :options="privilegeOptions"
                        type="radio"
                        dense
                        inline
                        :disable="!ruleFor(row.id).enabled"
                        @update:model-value="(v) => setRulePrivilege(row.id, v as RolePrivilege)"
                      />
                    </td>
                  </tr>
                </tbody>
              </q-markup-table>
            </div>
          </template>
          <div v-else class="text-grey-6 text-body2 col flex flex-center">
            {{ $text('role.select_or_create_role') }}
          </div>
        </div>
      </q-card-section>

      <q-card-actions align="right" class="q-pt-none settings-dialog-footer-actions">
        <q-btn
          outline
          color="secondary"
          icon="badge"
          class="settings-dialog-surface-btn"
          :label="$text('role.assign_roles_per_group')"
          @click="openRoleAssignment"
        />
        <q-btn
          flat
          class="settings-dialog-surface-btn"
          :label="$text('action.cancel')"
          @click="dialogVisible = false"
        />
        <q-btn
          unelevated
          color="primary"
          :label="$text('action.save')"
          :disable="!dirty || !profiles.length"
          :loading="saving"
          @click="saveAll"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import { Notify } from 'quasar';
import type { QInput } from 'quasar';
import { $text } from 'src/modules/lang';
import type { AccessRange, RolePrivilege } from 'src/modules/storage/sync/RoleModel';
import {
  createRoleProfile,
  type FunctionAccessRule,
  type RoleProfileData,
} from 'src/modules/storage/sync/RoleProfileModel';
import {
  ROLE_FUNCTION_IDS,
  defaultFunctionAccessRule,
  syncFunctionAccess,
  type RoleFunctionId,
} from 'src/modules/storage/sync/roleFunctionCatalog';
import { loadRoleProfiles, saveRoleProfiles } from 'src/modules/storage/sync/roleProfileSettings';
import logger from 'src/utils/logger';
import { useSettingsDialogLayout } from 'src/composables/useSettingsDialogLayout';
import { dispatchCaptureSyncBaseline } from 'src/modules/storage/sync/syncContractUi';

const { dialogBind, cardClass, cardStyle, bodyClass, bodyStyle, isMobile } =
  useSettingsDialogLayout(720);

const props = withDefaults(
  defineProps<{ modelValue: boolean; initialAction?: 'none' | 'new' }>(),
  { initialAction: 'none' },
);
const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
  (e: 'saved'): void;
  (e: 'open-role-assignment'): void;
}>();

function openRoleAssignment(): void {
  emit('open-role-assignment');
}

const dialogVisible = computed({
  get: () => !!props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
});

const profiles = ref<RoleProfileData[]>([]);
const selectedRoleId = ref<string | null>(null);
const editing = ref<RoleProfileData | null>(null);
const roleNameInput = ref('');
const roleNameInputRef = ref<QInput | null>(null);
const dirty = ref(false);
const saving = ref(false);

async function focusRoleNameInput(): Promise<void> {
  await nextTick();
  await nextTick();
  roleNameInputRef.value?.focus?.();
}

const rangeOptions = computed(() => [
  { label: $text('role.range_strict'), value: 'single' as AccessRange },
  { label: $text('role.range_children'), value: 'child' as AccessRange },
  { label: $text('role.range_all'), value: 'max' as AccessRange },
]);

const privilegeOptions = computed(() => [
  { label: $text('role.priv_show'), value: 'preview' as RolePrivilege },
  { label: $text('role.priv_edit'), value: 'edit' as RolePrivilege },
  { label: $text('role.priv_owner'), value: 'full' as RolePrivilege },
]);

const functionRows = computed(() =>
  ROLE_FUNCTION_IDS.map((id) => ({
    id,
    label: $text(`func.${id}`),
  })),
);

const editingRulesMap = computed(() => {
  if (!editing.value) return new Map<string, FunctionAccessRule>();
  const synced = syncFunctionAccess(editing.value.functionAccess);
  return new Map(synced.map((r) => [r.functionId, r]));
});

function cloneProfile(p: RoleProfileData): RoleProfileData {
  return {
    ...p,
    functionAccess: p.functionAccess.map((g) => ({ ...g })),
  };
}

function markDirty(): void {
  dirty.value = true;
}

function displayRoleName(role: RoleProfileData): string {
  const raw =
    selectedRoleId.value === role.id && editing.value
      ? roleNameInput.value
      : role.name;
  return raw.trim() || $text('role.unnamed');
}

function onRoleNameInput(v: string | number | null): void {
  roleNameInput.value = String(v ?? '');
  if (editing.value) {
    editing.value.name = roleNameInput.value;
  }
  markDirty();
}

function syncEditingFunctionAccess(): void {
  if (!editing.value) return;
  editing.value.functionAccess = syncFunctionAccess(editing.value.functionAccess);
}

function selectRole(id: string): void {
  commitEditingToList();
  selectedRoleId.value = id;
  const found = profiles.value.find((p) => p.id === id);
  editing.value = found ? cloneProfile(found) : null;
  roleNameInput.value = editing.value?.name ?? '';
  syncEditingFunctionAccess();
}

function commitEditingToList(): void {
  if (!editing.value || !selectedRoleId.value) return;
  const idx = profiles.value.findIndex((p) => p.id === selectedRoleId.value);
  if (idx < 0) return;
  const next = [...profiles.value];
  next[idx] = {
    ...editing.value,
    name: roleNameInput.value.trim(),
    functionAccess: syncFunctionAccess(editing.value.functionAccess),
    updatedAt: Date.now(),
  };
  profiles.value = next;
}

function addRole(): void {
  commitEditingToList();
  const created = createRoleProfile('');
  profiles.value = [...profiles.value, created];
  selectedRoleId.value = created.id;
  editing.value = cloneProfile(created);
  editing.value.name = '';
  roleNameInput.value = '';
  dirty.value = true;
  void focusRoleNameInput();
}

function deleteRole(id: string): void {
  profiles.value = profiles.value.filter((p) => p.id !== id);
  if (selectedRoleId.value === id) {
    selectedRoleId.value = profiles.value[0]?.id ?? null;
    editing.value = selectedRoleId.value
      ? cloneProfile(profiles.value.find((p) => p.id === selectedRoleId.value)!)
      : null;
    roleNameInput.value = editing.value?.name ?? '';
    syncEditingFunctionAccess();
  }
  dirty.value = true;
}

function ruleFor(functionId: RoleFunctionId): FunctionAccessRule {
  return editingRulesMap.value.get(functionId) ?? defaultFunctionAccessRule(functionId);
}

function patchRule(functionId: RoleFunctionId, patch: Partial<FunctionAccessRule>): void {
  if (!editing.value) return;
  const rules = syncFunctionAccess(editing.value.functionAccess);
  const idx = rules.findIndex((r) => r.functionId === functionId);
  const base = idx >= 0 ? rules[idx]! : defaultFunctionAccessRule(functionId);
  const updated = { ...base, ...patch, functionId };
  if (idx >= 0) {
    rules[idx] = updated;
  } else {
    rules.push(updated);
  }
  editing.value.functionAccess = [...rules];
  markDirty();
}

function setRuleEnabled(functionId: RoleFunctionId, enabled: boolean): void {
  patchRule(functionId, { enabled });
}

function setRulePrivilege(functionId: RoleFunctionId, privilege: RolePrivilege): void {
  patchRule(functionId, { privilege, enabled: true });
}

function setAccessRange(accessRange: AccessRange): void {
  if (!editing.value) return;
  editing.value.accessRange = accessRange;
  markDirty();
}

async function loadAll(selectNew = false): Promise<void> {
  profiles.value = await loadRoleProfiles();
  for (const p of profiles.value) {
    p.functionAccess = syncFunctionAccess(p.functionAccess);
  }
  if (selectNew) {
    addRole();
    return;
  }
  selectedRoleId.value = profiles.value[0]?.id ?? null;
  editing.value = selectedRoleId.value
    ? cloneProfile(profiles.value.find((p) => p.id === selectedRoleId.value)!)
    : null;
  roleNameInput.value = editing.value?.name ?? '';
  dirty.value = false;
}

async function saveAll(): Promise<void> {
  commitEditingToList();
  const unnamed = profiles.value.find((p) => !p.name.trim());
  if (unnamed) {
    if (unnamed.id === selectedRoleId.value) {
      await focusRoleNameInput();
    } else {
      selectRole(unnamed.id);
      await focusRoleNameInput();
    }
    Notify.create({
      type: 'warning',
      message: $text('role.name_required'),
      timeout: 3000,
    });
    return;
  }
  saving.value = true;
  try {
    const ok = await saveRoleProfiles(profiles.value);
    if (ok) {
      dirty.value = false;
      emit('saved');
      dialogVisible.value = false;
    }
  } catch (e) {
    logger.error('[RolesSetupDialog] save failed', e);
  } finally {
    saving.value = false;
  }
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      dispatchCaptureSyncBaseline();
      void loadAll(props.initialAction === 'new');
    }
    else {
      profiles.value = [];
      selectedRoleId.value = null;
      editing.value = null;
      roleNameInput.value = '';
      dirty.value = false;
    }
  },
);
</script>

<style scoped>
.role-access-table :deep(.q-radio) {
  margin-right: 8px;
}
.role-access-table :deep(thead th) {
  position: sticky;
  top: 0;
  z-index: 1;
}
</style>
