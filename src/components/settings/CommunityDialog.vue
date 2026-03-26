<template>
  <q-dialog v-model="visible" persistent>
    <q-card style="min-width: 520px; max-width: 94vw">

      <!-- ── Header ───────────────────────────────────────────────────── -->
      <q-card-section class="row items-center q-pb-none">
        <div>
          <div class="text-h6">Community Management</div>
          <div class="text-caption text-grey-6">Devices in your sync network</div>
        </div>
        <q-space />
        <q-btn icon="close" flat round dense @click="visible = false" />
      </q-card-section>

      <!-- ── This device ──────────────────────────────────────────────── -->
      <q-card-section>
        <div class="text-subtitle2 q-mb-sm">This device</div>
        <q-input
          dense
          outlined
          v-model="ownDeviceName"
          label="Your device name (shown to others)"
          @blur="saveOwnDeviceName"
        />
        <div class="text-caption text-grey-6 q-mt-xs">
          ID: {{ ownDeviceId || '—' }}
        </div>
      </q-card-section>

      <q-separator />

      <!-- ── Known devices ────────────────────────────────────────────── -->
      <q-card-section>
        <div class="row items-center q-mb-sm">
          <div class="text-subtitle2">Devices</div>
          <q-space />
          <q-btn
            dense
            unelevated
            color="primary"
            icon="bluetooth_searching"
            label="Scan"
            size="sm"
            @click="showScanModal = true"
          />
        </div>

        <div v-if="profiles.length === 0" class="text-caption text-grey-6 q-py-sm">
          No devices added yet. Use Scan to discover nearby devices.
        </div>

        <q-list bordered separator v-else>
          <q-expansion-item
            v-for="p in profiles"
            :key="p.id"
            expand-separator
          >
            <!-- ── Device header slot ──────────────────────────────── -->
            <template #header>
              <q-item-section avatar style="width: 36px; min-width: 36px">
                <q-icon :name="transportIcon(p.transport)" :color="trustColor(p.trustStatus)" />
              </q-item-section>

              <q-item-section>
                <!-- Alias inline edit -->
                <q-input
                  v-if="editing === p.id"
                  dense
                  autofocus
                  v-model="editAlias"
                  placeholder="Alias (optional)"
                  style="max-width: 220px"
                  @keyup.enter="commitAlias(p)"
                  @keyup.escape="editing = null"
                  @blur="commitAlias(p)"
                  @click.stop
                />
                <div
                  v-else
                  class="cursor-pointer row items-center"
                  style="font-weight: 500"
                  @click.stop="startEdit(p)"
                >
                  {{ p.displayName }}
                  <q-icon name="edit" size="12px" class="text-grey-5 q-ml-xs" />
                </div>

                <div v-if="p.alias" class="text-caption text-grey-6">
                  Device name: {{ p.remoteName }}
                </div>
                <div class="text-caption text-grey-6 row items-center q-gutter-xs">
                  <span>{{ p.transport }}</span>
                  <span>·</span>
                  <span>{{ formatLastSeen(p.lastSeen) }}</span>
                  <span>·</span>
                  <span>{{ p.groupLinks.length }} group{{ p.groupLinks.length === 1 ? '' : 's' }}</span>
                </div>
              </q-item-section>

              <q-item-section side>
                <div class="row items-center q-gutter-xs">
                  <q-badge :color="trustColor(p.trustStatus)" :label="p.trustStatus" />
                  <q-btn
                    flat dense round icon="delete" color="negative" size="sm"
                    @click.stop="removeProfile(p.id)"
                  />
                </div>
              </q-item-section>
            </template>

            <!-- ── Groups panel ────────────────────────────────────── -->
            <div class="q-pa-md q-pt-sm bg-grey-1">
              <div class="text-subtitle2 q-mb-sm">Group access</div>

              <!-- Current links -->
              <q-list dense v-if="p.groupLinks.length">
                <q-item v-for="link in p.groupLinks" :key="link.groupId" class="q-px-none">
                  <q-item-section avatar style="width: 28px; min-width: 28px">
                    <q-icon name="folder" size="16px" :color="groupColor(link.groupId)" />
                  </q-item-section>
                  <q-item-section>
                    <span>{{ groupName(link.groupId) }}</span>
                  </q-item-section>
                  <q-item-section side>
                    <div class="row items-center q-gutter-xs">
                      <q-badge :color="privilegeColor(link.privilege)" :label="link.privilege" />
                      <q-btn
                        flat dense round icon="close" size="xs" color="grey-7"
                        @click="unlinkGroup(p, link.groupId)"
                      />
                    </div>
                  </q-item-section>
                </q-item>
              </q-list>
              <div v-else class="text-caption text-grey-6 q-mb-sm">
                No groups linked. Add one below.
              </div>

              <!-- Add group form -->
              <div class="row q-gutter-sm q-mt-sm items-end">
                <!-- Group tree selector -->
                <div class="col">
                  <div class="text-caption text-grey-7 q-mb-xs">Group</div>
                  <q-btn-dropdown
                    dense
                    outlined
                    no-icon-animation
                    color="grey-8"
                    style="width: 100%; text-align: left"
                    :label="pendingGroupLabel(p.id) || 'Select group…'"
                  >
                    <q-tree
                      :nodes="groupTree"
                      node-key="id"
                      label-key="name"
                      selected-color="primary"
                      v-model:selected="pendingGroupId[p.id]"
                      default-expand-all
                      no-connectors
                      style="min-width: 220px; padding: 8px"
                    />
                  </q-btn-dropdown>
                </div>

                <!-- Privilege selector -->
                <div style="width: 110px">
                  <div class="text-caption text-grey-7 q-mb-xs">Privilege</div>
                  <q-select
                    dense
                    outlined
                    v-model="pendingPrivilege[p.id]"
                    :options="PRIVILEGE_OPTIONS"
                    emit-value
                    map-options
                  />
                </div>

                <q-btn
                  dense
                  unelevated
                  color="primary"
                  icon="add"
                  :disable="!pendingGroupId[p.id]"
                  @click="linkGroup(p)"
                />
              </div>
            </div>

          </q-expansion-item>
        </q-list>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Close" color="primary" @click="visible = false" />
      </q-card-actions>

    </q-card>
  </q-dialog>

  <BluetoothScanModal v-model:modelValue="showScanModal" @connect="onDeviceDiscovered" />
</template>

<script setup lang="ts">
import { ref, computed, onMounted, reactive } from 'vue';
import BluetoothScanModal from './BluetoothScanModal.vue';
import { deviceRegistry } from 'src/modules/storage/sync/DeviceRegistry';
import { deviceId } from 'src/modules/storage/sync/deviceId';
import { DeviceProfile } from 'src/modules/storage/sync/DeviceProfile';
import type { DeviceTransport, DeviceTrustStatus, GroupPrivilege } from 'src/modules/storage/sync/DeviceProfile';
import CC from 'src/CentralController';

// ── Props / emit ──────────────────────────────────────────────────────────────

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>();

const visible = computed<boolean>({
  get: () => !!props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
});

// ── This device ───────────────────────────────────────────────────────────────

const ownDeviceId = ref<string | null>(deviceId.getSync());
const ownDeviceName = ref('');

onMounted(async () => {
  ownDeviceId.value = await deviceId.get();
  // TODO: load ownDeviceName from settings key 'ownDeviceName'
});

function saveOwnDeviceName(): void {
  // TODO: await storage.setSetting('ownDeviceName', ownDeviceName.value)
}

// ── Known devices list ────────────────────────────────────────────────────────

const profiles = computed(() => deviceRegistry.getAll());

// ── Inline alias editing ──────────────────────────────────────────────────────

const editing = ref<string | null>(null);
const editAlias = ref('');

function startEdit(p: DeviceProfile): void {
  editing.value = p.id;
  editAlias.value = p.alias;
}

async function commitAlias(p: DeviceProfile): Promise<void> {
  if (editing.value === p.id) {
    await deviceRegistry.update(p.id, { alias: editAlias.value.trim() });
  }
  editing.value = null;
}

async function removeProfile(id: string): Promise<void> {
  await deviceRegistry.remove(id);
}

// ── Group linking ─────────────────────────────────────────────────────────────

// Per-device pending selects (keyed by profile.id)
const pendingGroupId = reactive<Record<string, string | null>>({});
const pendingPrivilege = reactive<Record<string, GroupPrivilege>>({});

const PRIVILEGE_OPTIONS = [
  { label: 'View (read-only)', value: 'view' as GroupPrivilege },
  { label: 'Sync (bidirectional)', value: 'sync' as GroupPrivilege },
  { label: 'Admin', value: 'admin' as GroupPrivilege },
];

function pendingGroupLabel(profileId: string): string {
  const gid = pendingGroupId[profileId];
  if (!gid) return '';
  return CC.group.groups.find((g: any) => g.id === gid)?.name ?? gid;
}

async function linkGroup(p: DeviceProfile): Promise<void> {
  const gid = pendingGroupId[p.id];
  const priv: GroupPrivilege = pendingPrivilege[p.id] ?? 'sync';
  if (!gid) return;

  // Don't duplicate
  if (p.groupLinks.some((l) => l.groupId === gid)) return;

  const updated = [
    ...p.groupLinks,
    { groupId: gid, privilege: priv, addedAt: new Date().toISOString() },
  ];
  await deviceRegistry.update(p.id, { groupLinks: updated });

  // Reset pending for this profile
  pendingGroupId[p.id] = null;
  pendingPrivilege[p.id] = 'sync';
}

async function unlinkGroup(p: DeviceProfile, groupId: string): Promise<void> {
  await deviceRegistry.update(p.id, {
    groupLinks: p.groupLinks.filter((l) => l.groupId !== groupId),
  });
}

// ── Group tree (for selector) ─────────────────────────────────────────────────

interface TreeNode {
  id: string;
  name: string;
  children?: TreeNode[];
}

const groupTree = computed<TreeNode[]>(() => {
  const all: any[] = CC.group.groups ?? [];
  const byParent = new Map<string | null, any[]>();
  for (const g of all) {
    const pid = g.parentId ?? null;
    if (!byParent.has(pid)) byParent.set(pid, []);
    byParent.get(pid)!.push(g);
  }
  function build(pid: string | null): TreeNode[] {
    return (byParent.get(pid) ?? []).map((g) => ({
      id: g.id,
      name: g.name,
      children: build(g.id),
    }));
  }
  return build(null);
});

// ── Group display helpers ─────────────────────────────────────────────────────

function groupName(groupId: string): string {
  return (CC.group.groups as any[])?.find((g) => g.id === groupId)?.name ?? groupId;
}

function groupColor(groupId: string): string {
  return (CC.group.groups as any[])?.find((g) => g.id === groupId)?.color ?? 'grey';
}

const PRIVILEGE_COLORS: Record<GroupPrivilege, string> = {
  view: 'blue-grey',
  sync: 'primary',
  admin: 'deep-orange',
};

function privilegeColor(p: GroupPrivilege): string {
  return PRIVILEGE_COLORS[p] ?? 'grey';
}

// ── Scan / discovery ──────────────────────────────────────────────────────────

const showScanModal = ref(false);

async function onDeviceDiscovered(discovered: {
  id: string;
  name: string;
  isApp: boolean;
}): Promise<void> {
  showScanModal.value = false;
  const existing = deviceRegistry.findByRemoteDeviceId(discovered.id);
  if (existing) return;

  await deviceRegistry.add(
    new DeviceProfile({
      remoteDeviceId: discovered.id,
      remoteName: discovered.name,
      transport: 'bluetooth' as DeviceTransport,
      trustStatus: 'pending',
    }),
  );
}

// ── Transport / trust display helpers ─────────────────────────────────────────

const TRANSPORT_ICONS: Record<DeviceTransport, string> = {
  bluetooth: 'bluetooth',
  p2p: 'device_hub',
  rest: 'cloud',
  unknown: 'devices_other',
};

const TRUST_COLORS: Record<DeviceTrustStatus, string> = {
  trusted: 'positive',
  pending: 'warning',
  blocked: 'negative',
};

function transportIcon(t: DeviceTransport): string {
  return TRANSPORT_ICONS[t] ?? 'devices_other';
}

function trustColor(s: DeviceTrustStatus): string {
  return TRUST_COLORS[s] ?? 'grey';
}

function formatLastSeen(iso: string | null): string {
  if (!iso) return 'never synced';
  const d = new Date(iso);
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleDateString();
}
</script>

