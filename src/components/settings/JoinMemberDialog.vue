<template>
  <q-dialog v-model="dialogVisible">
    <q-card style="min-width: 720px; max-width: 920px">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6 col">{{ $text('ui.join_device') }}</div>
        <q-btn
          class="col-auto"
          outline
          color="primary"
          icon="admin_panel_settings"
          :label="$text('role.setup_title')"
          @click="emit('open-roles-setup')"
        />
      </q-card-section>

      <q-card-section class="q-pt-none row q-col-gutter-md">
        <div class="col-12 col-md-4">
          <div class="text-subtitle2 q-mb-sm">{{ $text('ui.select_group') }}</div>
          <q-list
            bordered
            separator
            class="rounded-borders join-member-group-list"
            style="max-height: 52vh; overflow: auto"
          >
            <q-item
              v-for="row in flatGroupRows"
              :key="row.id"
              clickable
              v-ripple
              :active="selectedGroupId === row.id"
              active-class="bg-primary text-white"
              @click="selectedGroupId = row.id"
            >
              <q-item-section avatar style="min-width: 32px">
                <q-icon
                  :name="row.icon || 'folder'"
                  :style="row.color ? { color: row.color } : undefined"
                />
              </q-item-section>
              <q-item-section :style="{ paddingLeft: `${row.depth * 12}px` }">
                {{ row.name }}
              </q-item-section>
            </q-item>
            <q-item v-if="!flatGroupRows.length">
              <q-item-section class="text-caption text-grey-6">
                {{ $text('role.no_groups') }}
              </q-item-section>
            </q-item>
          </q-list>
        </div>

        <div class="col-12 col-md-8 column">
          <div
            v-if="selectedGroupName"
            class="text-subtitle1 text-primary q-mb-md"
          >
            {{ $text('role.roles_for_group') }}: <strong>{{ selectedGroupName }}</strong>
          </div>

          <div v-if="!selectedGroupId" class="text-grey-6 text-caption">
            {{ $text('role.select_group_first') }}
          </div>

          <div v-else-if="!roleProfiles.length" class="text-body2 text-grey-7">
            {{ $text('role.no_role_profiles') }}
            <q-btn
              flat
              dense
              color="primary"
              class="q-mt-sm"
              :label="$text('role.setup_title')"
              @click="emit('open-roles-setup')"
            />
          </div>

          <div v-else-if="!applicableRoles.length" class="text-body2 text-grey-7">
            {{ $text('role.no_roles_apply_to_group') }}
            <q-btn
              flat
              dense
              color="primary"
              class="q-mt-sm block"
              icon="admin_panel_settings"
              :label="$text('role.setup_title')"
              @click="emit('open-roles-setup')"
            />
          </div>

          <div v-else class="column q-gutter-md" style="max-height: 52vh; overflow: auto">
            <q-card
              v-for="role in applicableRoles"
              :key="role.id"
              bordered
              flat
              class="rounded-borders"
            >
              <q-card-section class="q-pb-sm">
                <div class="text-subtitle2">{{ role.name }}</div>
                <div class="text-caption text-grey-7 q-mt-xs">
                  {{ roleRuleCaption(role) }}
                </div>
              </q-card-section>

              <q-separator />

              <q-card-section class="q-pt-sm q-pb-sm">
                <div class="text-caption text-weight-medium text-grey-8 q-mb-xs">
                  {{ $text('role.direct_devices') }}
                </div>
                <q-list v-if="directDevices(role.id).length" dense bordered separator class="rounded-borders">
                  <q-item v-for="d in directDevices(role.id)" :key="d.id">
                    <q-item-section>
                      <q-item-label>{{ d.name }}</q-item-label>
                      <q-item-label v-if="d.type" caption>{{ d.type }}</q-item-label>
                    </q-item-section>
                    <q-item-section side>
                      <q-btn
                        flat
                        dense
                        size="sm"
                        color="negative"
                        icon="link_off"
                        :label="$text('role.disconnect_device')"
                        @click="disconnectDirect(d.id)"
                      />
                    </q-item-section>
                  </q-item>
                </q-list>
                <div v-else class="text-caption text-grey-6 q-mb-sm">
                  {{ $text('role.no_devices_on_role') }}
                </div>

                <q-select
                  v-if="assignableDevices(role.id).length"
                  dense
                  outlined
                  emit-value
                  map-options
                  :options="assignableDeviceOptions(role.id)"
                  :label="$text('role.assign_device')"
                  class="q-mt-sm"
                  :model-value="null"
                  @update:model-value="(id) => assignDeviceToRole(id as string, role.id)"
                />
              </q-card-section>

              <q-card-section
                v-if="inheritedDevices(role.id).length"
                class="q-pt-none bg-grey-2"
              >
                <div class="text-caption text-weight-medium text-grey-8 q-mb-xs">
                  {{ $text('role.inherited_devices') }}
                </div>
                <q-list dense>
                  <q-item v-for="row in inheritedDevices(role.id)" :key="row.device.id">
                    <q-item-section>
                      <q-item-label>{{ row.device.name }}</q-item-label>
                      <q-item-label caption class="text-warning-9">
                        {{ $text('role.inherited_from') }}
                        <strong>{{ row.assignment.sourceGroupName }}</strong>
                        ({{ $text('role.privilege') }}: {{ row.assignment.roleName }})
                      </q-item-label>
                    </q-item-section>
                    <q-item-section side>
                      <q-icon name="account_tree" color="grey-6" size="sm">
                        <q-tooltip>{{ $text('role.inherited_no_disconnect') }}</q-tooltip>
                      </q-icon>
                    </q-item-section>
                  </q-item>
                </q-list>
              </q-card-section>
            </q-card>

            <div v-if="unassignedDevices.length" class="q-mt-sm">
              <div class="text-caption text-grey-7 q-mb-xs">{{ $text('role.unassigned_devices') }}</div>
              <div class="text-caption text-grey-6">
                <span v-for="(d, i) in unassignedDevices" :key="d.id">
                  {{ d.name }}<span v-if="i < unassignedDevices.length - 1">, </span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat :label="$text('action.close')" color="primary" @click="dialogVisible = false" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { $text } from 'src/modules/lang';
import CC from 'src/CCAccess';
import type { AccessRange, RolePrivilege } from 'src/modules/storage/sync/RoleModel';
import type { RoleProfileData } from 'src/modules/storage/sync/RoleProfileModel';
import { loadRoleProfiles } from 'src/modules/storage/sync/roleProfileSettings';
import type { RoleFunctionId } from 'src/modules/storage/sync/roleFunctionCatalog';
import {
  devicesDirectlyOnRole,
  devicesInheritedOnRole,
  devicesUnassignedOnGroup,
  loadConnectedDevices,
  normalizeGroupsFromCc,
  resolveEffectiveRole,
  roleProfileSummaryLabel,
  rolesApplicableToGroup,
  saveConnectedDevices,
  type ConnectedDevice,
  type GroupRecord,
} from 'src/modules/storage/sync/deviceRoleAssignment';

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
  (e: 'open-roles-setup'): void;
}>();

const dialogVisible = computed({
  get: () => !!props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
});

const selectedGroupId = ref<string | null>(null);
const roleProfiles = ref<RoleProfileData[]>([]);
const devices = ref<ConnectedDevice[]>([]);
const groups = ref<GroupRecord[]>([]);

type FlatGroupRow = {
  id: string;
  name: string;
  depth: number;
  icon?: string;
  color?: string | null;
};

function flattenGroupList(list: GroupRecord[], parentId: string | null = null, depth = 0): FlatGroupRow[] {
  const out: FlatGroupRow[] = [];
  const pid = parentId ?? null;
  for (const g of list) {
    const gParent = g.parentId ?? null;
    if (gParent !== pid) continue;
    const src = CC.group.list.find(g.id) as { icon?: string; color?: string } | undefined;
    out.push({
      id: g.id,
      name: g.name,
      depth,
      icon: src?.icon ?? 'folder',
      color: src?.color ?? null,
    });
    out.push(...flattenGroupList(list, g.id, depth + 1));
  }
  return out;
}

const flatGroupRows = computed(() => flattenGroupList(groups.value));

const selectedGroupName = computed(() => {
  if (!selectedGroupId.value) return '';
  return groups.value.find((g) => g.id === selectedGroupId.value)?.name ?? '';
});

const applicableRoles = computed(() => {
  if (!selectedGroupId.value) return [];
  return rolesApplicableToGroup(roleProfiles.value, groups.value, selectedGroupId.value);
});

const unassignedDevices = computed(() => {
  if (!selectedGroupId.value) return [];
  return devicesUnassignedOnGroup(
    devices.value,
    groups.value,
    roleProfiles.value,
    selectedGroupId.value,
  );
});

function labelRange(r: AccessRange): string {
  if (r === 'single') return $text('role.range_strict');
  if (r === 'child') return $text('role.range_children');
  return $text('role.range_all');
}

function labelPriv(p: RolePrivilege): string {
  if (p === 'preview') return $text('role.priv_show');
  if (p === 'edit') return $text('role.priv_edit');
  return $text('role.priv_owner');
}

function labelFunction(functionId: RoleFunctionId): string {
  const key = `func.${functionId}`;
  const t = $text(key);
  return t !== key ? t : functionId;
}

function roleRuleCaption(role: RoleProfileData): string {
  return roleProfileSummaryLabel(role, labelRange, labelPriv, labelFunction);
}

function directDevices(roleProfileId: string): ConnectedDevice[] {
  if (!selectedGroupId.value) return [];
  return devicesDirectlyOnRole(devices.value, selectedGroupId.value, roleProfileId);
}

function inheritedDevices(roleProfileId: string) {
  if (!selectedGroupId.value) return [];
  return devicesInheritedOnRole(
    devices.value,
    groups.value,
    roleProfiles.value,
    selectedGroupId.value,
    roleProfileId,
  );
}

function assignableDevices(roleProfileId: string): ConnectedDevice[] {
  if (!selectedGroupId.value) return [];
  const gid = selectedGroupId.value;
  return devices.value.filter((d) => d.rolesByGroup?.[gid] !== roleProfileId);
}

function assignableDeviceOptions(roleProfileId: string) {
  return assignableDevices(roleProfileId).map((d) => ({ label: d.name, value: d.id }));
}

async function persistDevices(): Promise<void> {
  await saveConnectedDevices(devices.value);
}

async function assignDeviceToRole(deviceId: string, roleProfileId: string): Promise<void> {
  if (!selectedGroupId.value || !deviceId) return;
  const gid = selectedGroupId.value;
  devices.value = devices.value.map((d) => {
    if (d.id !== deviceId) return d;
    const rolesByGroup = { ...(d.rolesByGroup ?? {}) };
    rolesByGroup[gid] = roleProfileId;
    return { ...d, rolesByGroup };
  });
  await persistDevices();
}

async function disconnectDirect(deviceId: string): Promise<void> {
  if (!selectedGroupId.value) return;
  const gid = selectedGroupId.value;
  devices.value = devices.value.map((d) => {
    if (d.id !== deviceId) return d;
    const rolesByGroup = { ...(d.rolesByGroup ?? {}) };
    delete rolesByGroup[gid];
    const next: ConnectedDevice = { id: d.id, name: d.name };
    if (d.type) next.type = d.type;
    if (d.lanHost) next.lanHost = d.lanHost;
    if (Object.keys(rolesByGroup).length) next.rolesByGroup = rolesByGroup;
    return next;
  });
  await persistDevices();
}

async function reload(): Promise<void> {
  roleProfiles.value = await loadRoleProfiles();
  devices.value = await loadConnectedDevices();
  try {
    groups.value = normalizeGroupsFromCc(CC.group.list.all.value ?? []);
  } catch {
    groups.value = [];
  }
}

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return;
    try {
      const active = CC.group.active.activeGroup.value;
      if (!active) {
        selectedGroupId.value = null;
      } else if (typeof active === 'string' || typeof active === 'number') {
        selectedGroupId.value = String(active);
      } else {
        const a = active as Record<string, unknown>;
        const raw = a.value ?? a.id ?? null;
        selectedGroupId.value =
          typeof raw === 'string' || typeof raw === 'number' ? String(raw) : null;
      }
    } catch {
      selectedGroupId.value = null;
    }
    void reload();
  },
);

watch(flatGroupRows, (rows) => {
  if (!props.modelValue || !rows.length) return;
  if (selectedGroupId.value && rows.some((r) => r.id === selectedGroupId.value)) return;
  selectedGroupId.value = rows[0]?.id ?? null;
});
</script>

<style scoped>
.join-member-group-list :deep(.q-item__section--avatar) {
  min-width: 32px;
}
</style>
