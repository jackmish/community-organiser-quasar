<template>
  <q-dialog v-model="dialogVisible" v-bind="dialogBind">
    <q-card :class="cardClass" :style="cardStyle">
      <q-card-section :class="headerClass">
        <div class="text-h6">Connections and data</div>
      </q-card-section>

      <q-card-section :class="[bodyClass, 'connections-dialog-body']" :style="bodyStyle">
        <div class="q-gutter-md">
          <SyncDialogBanner
            v-if="showIncomingContract"
            icon="sync"
            :message="incomingContractMessage"
            :button-label="$text('sync.incoming_review_btn')"
            :mobile="isMobile"
            @action="openIncomingContractReview"
          />
          <SyncDialogBanner
            v-else-if="hasPendingSendAction"
            icon="hourglass_top"
            :message="$text('sync.pending_send_banner')"
            :button-label="pendingActionsMenuLabel"
            :mobile="isMobile"
            @action="openPendingActionsDialog"
          />
          <SyncDialogBanner
            v-else-if="hasPendingChanges"
            icon="sync"
            :message="$text('sync.confirm_pending_banner')"
            :button-label="$text('sync.confirm_changes_btn')"
            :mobile="isMobile"
            @action="startConfirmChanges"
          />
          <div class="row items-center q-gutter-sm q-mb-sm settings-dialog-header-actions"
            :class="{ column: isMobile }">
            <q-btn outline color="secondary" icon="badge" :label="assignRolesPerGroupLabel"
              class="col-grow settings-dialog-surface-btn" @click="showJoinMemberDialog = true" />
            <q-btn outline color="primary" icon="admin_panel_settings" :label="rolesSetupLabel"
              class="col-grow settings-dialog-surface-btn" @click="openRolesSetup" />
            <q-btn
              v-if="showRenewContract && !showIncomingContract"
              outline
              color="positive"
              icon="autorenew"
              :label="$text('sync.renew_contract_btn')"
              class="col-grow settings-dialog-surface-btn"
              @click="startRenewContract"
            />
          </div>
          <p
            v-if="showRenewContract && !showIncomingContract"
            class="text-caption text-grey-7 q-mb-sm q-mt-none"
          >
            {{ $text('sync.renew_contract_hint') }}
          </p>


          <div class="row items-center q-gutter-sm" :class="{ 'column items-stretch': isMobile }">
            <div :class="isMobile ? 'col-12' : 'col'">{{ devicesSummary }}</div>
            <div :class="isMobile ? 'col-12' : 'col-auto'">
              <q-btn
                unelevated
                color="positive"
                class="connections-add-device-btn full-width"
                @click="openAddConnectionDialog('lan')"
              >
                <q-icon name="add" size="20px" class="q-mr-xs" />
                <q-icon name="devices" size="20px" class="q-mr-sm" />
                {{ $text('connections.add_device') }}
              </q-btn>
            </div>
          </div>
          <div class="connections-devices-panel q-mt-md">
            <div v-if="!devices.length" class="text-body2 text-grey-7 q-pa-sm">
              {{ $text('connections.no_devices') }}
            </div>
            <div v-else class="connections-devices-list column q-gutter-sm">
              <div v-for="d in devices" :key="d.id" class="connections-device-card"
                :class="{ 'connections-device-card--local': d.isLocal }">
                <div class="row items-start q-col-gutter-sm" :class="{ column: isMobile }">
                  <div class="col row items-start no-wrap q-gutter-sm">
                    <q-icon :name="deviceIcon(d)" size="22px" class="connections-device-card__icon q-mt-xs" />
                    <div class="col" style="min-width: 0">
                      <template v-if="d.isLocal">
                        <div class="connections-local-name column q-gutter-xs">
                          <div class="row items-center q-gutter-sm">
                            <q-input
                              v-model="ownDeviceName"
                              class="col connections-device-name-input"
                              dense
                              outlined
                              hide-bottom-space
                              :label="$text('connections.your_device_name')"
                              @keyup.enter="saveOwnDeviceName"
                              @blur="onOwnDeviceNameBlur"
                            />
                            <q-btn
                              class="col-auto"
                              dense
                              unelevated
                              :color="ownDeviceNameShowSaved ? 'positive' : 'primary'"
                              :icon="ownDeviceNameShowSaved ? 'check' : 'save'"
                              :label="ownDeviceNameShowSaved ? $text('connections.name_saved') : $text('connections.name_save')"
                              :disable="!ownDeviceNameDirty || ownDeviceNameSaving"
                              :loading="ownDeviceNameSaving"
                              @click="saveOwnDeviceName"
                            />
                          </div>
                          <div
                            v-if="savedOwnDeviceName"
                            class="text-caption connections-local-name__hint"
                          >
                            {{
                              ownDeviceNameFromHost
                                ? $text('connections.device_name_from_system')
                                : $text('connections.device_name_persisted')
                            }}
                          </div>
                        </div>
                      </template>
                      <div v-else class="text-subtitle2 text-weight-medium connections-device-card__name">
                        {{ d.name }}
                      </div>
                      <div v-if="!d.isLocal" class="text-caption connections-device-card__meta">
                        {{ d.type || 'Device' }}
                        <span v-if="d.lanHost"> · {{ d.lanHost }}</span>
                      </div>
                      <div v-if="!d.isLocal" class="row items-center q-gutter-xs q-mt-sm">
                        <q-input :model-value="deviceSyncInterval(d)" type="number" dense outlined
                          class="connections-device-sync-input" style="max-width: 140px"
                          :label="$text('sync.per_device_interval_label')" :min="minSyncInterval" :max="maxSyncInterval"
                          @update:model-value="(v) => setDeviceSyncInterval(d.id, v)" @blur="void saveDevicesToStorage()" />
                        <span class="text-caption text-grey-7">
                          {{ $text('sync.interval_unit') }}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div class="row items-center q-gutter-xs"
                    :class="isMobile ? 'settings-dialog-device-actions' : 'col-auto'">
                    <button v-if="!d.isLocal" type="button" class="connections-check-btn" :class="checkBtnClass(d.id)"
                      :disabled="deviceCheckState(d.id) === 'checking'"
                      :aria-busy="deviceCheckState(d.id) === 'checking'" @click.stop="onCheckDevice(d)">
                      <span class="connections-check-btn__inner">
                        <q-spinner v-if="deviceCheckState(d.id) === 'checking'" size="16px"
                          class="connections-check-btn__spinner" />
                        <span>{{ checkBtnLabel(d.id) }}</span>
                      </span>
                    </button>
                    <q-btn v-if="!d.isLocal" dense flat round icon="delete" color="negative"
                      @click="removeDevice(d.id)" />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <q-expansion-item class="connections-backup-expansion q-mt-md" expand-separator icon="backup" label="Backup"
            caption="Export, merge, override, and automatic local backup">
            <div class="q-pt-sm">
              <div class="row items-center q-gutter-sm" :class="{ column: isMobile, 'items-stretch': isMobile }">
                <div :class="isMobile ? 'col-12' : 'col'">
                  Make manual backup, merge current state with data from file, or totally replace
                  current data with data from file
                </div>
                <div :class="isMobile ? 'col-12' : 'col-auto'" :style="isMobile
                  ? {
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'stretch',
                    width: '100%',
                  }
                  : {
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                    justifyContent: 'center',
                  }
                  ">
                  <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 6px">
                    <q-btn dense unelevated color="primary" label="Export" @click="hasElectronAPI ? exportWithPicker() : exportAsJsonDownload()" />
                    <q-btn dense outline color="secondary" label="Merge" @click="triggerImport" />
                    <q-btn v-if="hasElectronAPI" dense unelevated color="negative" label="Override" @click="overrideBackup" />
                  </div>
                  <div v-if="exportState !== 'idle'" style="margin-top: 6px; width: 100%; text-align: left">
                    <div class="text-caption" style="display: flex; align-items: center; gap: 8px">
                      <q-spinner v-if="exportState === 'exporting'" size="18" />
                      <q-icon v-else-if="exportState === 'done'" name="check" color="positive" size="18" />
                      <q-icon v-else-if="exportState === 'error'" name="error" color="negative" size="18" />
                      <span>{{ exportMessage }}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div v-if="hasElectronAPI" class="q-mt-md">
                <div class="row items-center q-gutter-sm">
                  <div class="col">
                    Automatic local backup

                    <q-toggle class="q-ml-sm" dense v-model="autoBackupEnabled" @update:model-value="onAutoToggle" />
                  </div>
                </div>
                <div v-if="autoBackupEnabled" class="q-mt-sm">
                  <div class="row items-center q-gutter-sm">
                    <div class="col-auto">Hours</div>
                    <div class="col-auto" style="width: 80px">
                      <q-input dense type="number" v-model.number="autoBackupHours" min="0" />
                    </div>
                    <div class="col-auto">Minutes</div>
                    <div class="col-auto" style="width: 80px">
                      <q-input dense type="number" v-model.number="autoBackupMinutes" min="0" />
                    </div>
                    <div class="col text-caption q-ml-md">
                      Minimum: 1min. Default: 1h. Last automatic backup:
                      <strong>{{ formattedLastAutoBackup }}</strong> | Next backup:
                      <strong>{{ nextInText }}</strong>
                    </div>
                  </div>
                  <div class="q-mt-xs text-caption text-white">
                    <div></div>
                    <div></div>
                  </div>
                </div>
              </div>
            </div>
          </q-expansion-item>
          <q-expansion-item class="connections-internet-expansion q-mt-md" expand-separator icon="cloud"
            label="Internet services" caption="External APIs used by the app">
            <div class="q-pt-sm">
              <div class="row items-center q-gutter-sm">
                <div class="col text-white">
                  <div class="text-caption text-white q-mt-xs"
                    style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis">
                    App is downloading data from following services/APIs:
                  </div>
                  <div class="text-caption text-white q-mt-xs">
                    <ul style="margin: 4px 0 0 16px; padding: 0; line-height: 1.35; color: inherit">
                      <li>
                        https://date.nager.at/api/v3/PublicHolidays/{year}/PL — public holidays
                        (country code PL). Once data is downloaded, it is stored locally on device.
                      </li>
                      <li>
                        https://www.google.com/favicon.ico — detect Internet connection status -
                        method will be changed, as for now it just works.
                      </li>
                    </ul>
                  </div>
                </div>
                <div class="col-auto">
                  <q-btn dense outline color="primary" label="Manage"
                    @click="() => toast('info', 'Internet settings not implemented')" />
                </div>
              </div>
            </div>
          </q-expansion-item>
        </div>
      </q-card-section>

      <q-card-actions align="right">
        <q-space />
        <q-btn dense flat label="Close" color="primary" @click="close" />
      </q-card-actions>
      <input ref="fileInput" type="file" accept="application/json" style="display: none" @change="onFileSelected" />
    </q-card>
    <AddConnectionDialog
      v-model="showAddConnectionDialog"
      :own-device-name="ownDeviceName"
      :pending-offer="lanPairingPendingOffer"
      :initial-tab="addConnectionTab"
      @paired="onLanPairedFromModal"
      @bluetooth-connect="onDeviceSelected"
    />
    <JoinMemberDialog v-model="showJoinMemberDialog" @open-roles-setup="onOpenRolesSetup" />

    <SyncContractPreviewDialog v-model="showPreviewDialog" v-model:interval-seconds="confirmIntervalSeconds"
      :duplicate-resolution="confirmDuplicateResolution" @update:duplicate-resolution="setDuplicateResolution"
      :preview="preview" :min-sync-interval="minSyncInterval" :max-sync-interval="maxSyncInterval"
      @confirm="onSyncPreviewConfirm" @cancel="onPreviewCancelled" />
    <PrivilegeChangeSyncDialog v-model="showPrivilegeDialog" :changes="privilegeChanges"
      @confirm="onPrivilegeDialogConfirm" @cancel="onPrivilegeDialogCancel" />
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch, onBeforeUnmount } from 'vue';
import { useQuasar } from 'quasar';
import { appNotify } from 'src/utils/appNotify';
import { $text } from 'src/modules/lang';
import logger from 'src/utils/logger';

const hasElectronAPI = typeof window !== 'undefined' && !!(window as any).electronAPI;
import { jsonStringField, type LanPeerInfo } from 'src/modules/lan/lanPairingClient';
import { probeLanPeerInfo } from 'src/modules/lan/lanPeerConnectivity';
import { isLanDebugCaptureActive, lanDebugNote } from 'src/modules/lan/lanDebugLog';
import {
  loadOwnDeviceMeta,
  normalizeDeviceId,
  parseConnectedDevice,
  maybeSeedOwnDeviceNameFromHost,
  saveOwnDeviceNameSetting,
  type ConnectedDevice,
} from 'src/modules/storage/sync/deviceRoleAssignment';
import { getSuggestedHostDeviceLabel } from 'src/modules/storage/sync/hostDeviceLabel';
import type { RoleProfileData } from 'src/modules/storage/sync/RoleProfileModel';
import { loadRoleProfiles } from 'src/modules/storage/sync/roleProfileSettings';
import { useSyncContractInDialog } from 'src/composables/useSyncContractInDialog';
import { useSyncContractIncomingNotice } from 'src/composables/useSyncContractIncomingNotice';
import SyncContractPreviewDialog from './SyncContractPreviewDialog.vue';
import PrivilegeChangeSyncDialog from './PrivilegeChangeSyncDialog.vue';
import { usePendingActions } from 'src/composables/usePendingActions';
import {
  dispatchPendingActionsChanged,
  OPEN_PENDING_ACTIONS_EVENT,
} from 'src/modules/storage/sync/syncPendingActions';
import {
  LAN_PAIRED_EVENT,
  LAN_PAIRING_PENDING_EVENT,
  clearLanPendingOffer,
  parseLanPendingDetail,
  peekLanPendingOffer,
  stashLanPendingOffer,
  type LanPairedDevicePayload,
  type LanPendingDetail,
} from 'src/modules/lan/lanPairingUi';
import {
  loadConnectionsDevices,
  saveConnectionsBackupSettings,
  saveConnectionsRegistry,
} from 'src/modules/storage/sync/connectionsDeviceStorage';
import AddConnectionDialog, { type AddConnectionTab } from './AddConnectionDialog.vue';
import JoinMemberDialog from './JoinMemberDialog.vue';
import SyncDialogBanner from './SyncDialogBanner.vue';
import { loadCo21Settings } from 'src/modules/storage/sync/roleProfileSettings';
import { refreshLanServerForConnections } from 'src/modules/lan/lanServerManager';
import { dispatchOpenRolesSetup } from 'src/modules/storage/sync/rolesSetupUi';
import {
  DEFAULT_SYNC_INTERVAL_SECONDS,
  MIN_SYNC_INTERVAL_SECONDS,
  MAX_SYNC_INTERVAL_SECONDS,
} from 'src/modules/storage/sync/syncContractSettings';
import { useSettingsDialogLayout } from 'src/composables/useSettingsDialogLayout';

const { dialogBind, cardClass, cardStyle, headerClass, bodyClass, bodyStyle, isMobile } =
  useSettingsDialogLayout(520, 680);

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>();

const dialogVisible = computed({
  get: () => !!props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
});

const devices = ref<ConnectedDevice[]>([]);
/** False until the registry has been read from disk — blocks premature saves. */
const devicesRegistryLoaded = ref(false);

type DeviceCheckState = 'idle' | 'checking' | 'success' | 'fail';
const deviceCheckById = reactive<Record<string, DeviceCheckState>>({});

function deviceCheckState(deviceId: string): DeviceCheckState {
  return deviceCheckById[deviceId] ?? 'idle';
}

function deviceIcon(d: ConnectedDevice): string {
  const t = String(d.type || '').toLowerCase();
  if (t.includes('lan') || t.includes('wifi')) return 'wifi';
  if (t.includes('bluetooth')) return 'bluetooth';
  return 'devices';
}

function checkBtnLabel(deviceId: string): string {
  const s = deviceCheckState(deviceId);
  if (s === 'success') return $text('connections.check_success');
  if (s === 'fail') return $text('connections.check_retry');
  return $text('connections.check_btn');
}

function checkBtnClass(deviceId: string): string {
  const s = deviceCheckState(deviceId);
  if (s === 'success') return 'connections-check-btn connections-check-btn--success';
  if (s === 'fail') return 'connections-check-btn connections-check-btn--fail';
  return 'connections-check-btn connections-check-btn--idle';
}

function syncDeviceRowFromLanPeer(storedId: string, info: LanPeerInfo): void {
  const peerId = info.deviceId.trim();
  const peerName = info.deviceName.trim();
  devices.value = devices.value.map((dev) => {
    if (dev.id !== storedId) return dev;
    const next: ConnectedDevice = { ...dev, id: peerId };
    if (peerName) next.name = peerName;
    return next;
  });
}

async function onCheckDevice(d: ConnectedDevice): Promise<void> {
  if (d.isLocal || deviceCheckState(d.id) === 'checking') return;
  const rowId = d.id;
  deviceCheckById[rowId] = 'checking';
  let successKey = rowId;
  try {
    if (isLanDebugCaptureActive()) {
      lanDebugNote(`Check ${d.name}`, `deviceId=${d.id} · lanHost=${(d.lanHost || '').trim() || '(none)'}`);
    }
    const probe = await probeLanPeerInfo(d, 8000);
    if (!probe.ok || !probe.info) {
      if (isLanDebugCaptureActive()) {
        lanDebugNote(`Check failed`, `${d.name}: no reachable /info`);
      }
      toast('warning', $text('connections.check_no_host'));
      deviceCheckById[rowId] = 'fail';
      return;
    }
    const info = probe.info;
    const peerNorm = normalizeDeviceId(info.deviceId);
    const storedNorm = normalizeDeviceId(d.id);
    if (peerNorm !== storedNorm) {
      const dupIdx = devices.value.findIndex(
        (x) => !x.isLocal && x.id !== d.id && normalizeDeviceId(x.id) === peerNorm,
      );
      if (dupIdx >= 0) {
        devices.value = devices.value.filter((_, i) => i !== dupIdx);
      }
      syncDeviceRowFromLanPeer(rowId, info);
      clearDeviceCheckState(rowId);
      successKey = info.deviceId.trim();
      void refreshLanServerForConnections(devices.value, ownDeviceName.value).then((next) => {
        devices.value = next;
      });
      toast('info', $text('connections.check_id_repaired'));
    } else {
      if (info.deviceName.trim() && info.deviceName.trim() !== d.name) {
        syncDeviceRowFromLanPeer(rowId, info);
      }
      toast('positive', $text('connections.check_toast_ok'));
    }
    deviceCheckById[successKey] = 'success';
  } catch (e: unknown) {
    if (isLanDebugCaptureActive()) {
      const msg = e instanceof Error ? e.message : String(e);
      lanDebugNote(`Check error`, `${d.name}: ${msg}`);
    }
    deviceCheckById[rowId] = 'fail';
  }
}

function clearDeviceCheckState(deviceId: string): void {
  delete deviceCheckById[deviceId];
}
const roleProfiles = ref<RoleProfileData[]>([]);

const {
  showPreviewDialog,
  showPrivilegeDialog,
  preview,
  privilegeChanges,
  confirmIntervalSeconds,
  confirmDuplicateResolution,
  setDuplicateResolution,
  hasPendingChanges,
  hasPendingSendAction,
  showRenewContract,
  refreshPendingSend,
  captureBaseline,
  startConfirmChanges,
  startRenewContract,
  onPreviewConfirm,
  onPrivilegeDialogConfirm,
  onPrivilegeDialogCancel,
  onPreviewCancelled,
  minSyncInterval,
  maxSyncInterval,
} = useSyncContractInDialog(devices, roleProfiles);

const {
  show: showIncomingContract,
  bannerMessage: incomingContractMessage,
  openReview: openIncomingContractReview,
  refresh: refreshIncomingContractNotice,
} = useSyncContractIncomingNotice();

const { count: pendingActionsCount } = usePendingActions();

const pendingActionsMenuLabel = computed(() => {
  const n = pendingActionsCount.value;
  return n > 0
    ? `${$text('sync.pending_actions_btn')} (${n})`
    : $text('sync.pending_actions_btn');
});

function openPendingActionsDialog(): void {
  window.dispatchEvent(new Event(OPEN_PENDING_ACTIONS_EVENT));
}

async function onSyncPreviewConfirm(): Promise<void> {
  await onPreviewConfirm();
  await saveDevicesToStorage();
  dispatchPendingActionsChanged();
}

function deviceSyncInterval(d: ConnectedDevice): number {
  return d.syncIntervalSeconds ?? DEFAULT_SYNC_INTERVAL_SECONDS;
}

function setDeviceSyncInterval(deviceId: string, v: string | number | null): void {
  const n = Math.min(
    maxSyncInterval,
    Math.max(minSyncInterval, Math.floor(Number(v) || DEFAULT_SYNC_INTERVAL_SECONDS)),
  );
  devices.value = devices.value.map((d) =>
    d.id === deviceId ? { ...d, syncIntervalSeconds: n } : d,
  );
}
const showAddConnectionDialog = ref(false);
const addConnectionTab = ref<AddConnectionTab>('lan');

function openAddConnectionDialog(tab: AddConnectionTab = 'lan'): void {
  addConnectionTab.value = tab;
  showAddConnectionDialog.value = true;
}

function removeDevice(id: string) {
  clearDeviceCheckState(id);
  devices.value = devices.value.filter((d) => d.id !== id);
  void saveConnectionsRegistry(devices.value, { allowRemoteRemoval: true });
}

function close() {
  dialogVisible.value = false;
}

// Scan modal handling
const $q = useQuasar();
const lanPairingPendingOffer = ref<LanPendingDetail | null>(null);
const showJoinMemberDialog = ref(false);

async function refreshRoleProfiles(): Promise<void> {
  roleProfiles.value = await loadRoleProfiles();
}
const rolesSetupLabel = computed(() => $text('role.setup_title'));
const assignRolesPerGroupLabel = computed(() => $text('role.assign_roles_per_group'));
const devicesSummary = computed(() => {
  const n = devices.value.length;
  if (!n) return $text('connections.no_devices');
  if (n === 1) return $text('connections.one_device');
  return `${n} ${$text('connections.devices_label')}`;
});

function openRolesSetup(): void {
  dispatchOpenRolesSetup();
}

function onOpenRolesSetup(): void {
  showJoinMemberDialog.value = false;
}

const fileInput = ref<HTMLInputElement | null>(null);
const ownDeviceName = ref<string>('');
const savedOwnDeviceName = ref<string>('');
const ownDeviceNameShowSaved = ref(false);
const ownDeviceNameSaving = ref(false);
/** True when the saved label matches the OS computer / hostname. */
const ownDeviceNameFromHost = ref(false);

const ownDeviceNameDirty = computed(
  () => ownDeviceName.value.trim() !== savedOwnDeviceName.value.trim(),
);

watch(ownDeviceName, () => {
  if (ownDeviceNameDirty.value) {
    ownDeviceNameShowSaved.value = false;
  }
});

// Automatic backup settings
const autoBackupEnabled = ref<boolean>(false);
const autoBackupHours = ref<number>(1); // default 1 hour
const autoBackupMinutes = ref<number>(0);
const lastAutoBackup = ref<number | null>(null);
const autoTimerId = ref<any>(null);
const autoBackupStatus = ref<string>('idle');
const now = ref<number>(Date.now());

const formattedLastAutoBackup = computed(() => {
  if (!lastAutoBackup.value) return 'never';
  try {
    return new Date(lastAutoBackup.value).toLocaleString();
  } catch (e) {
    return String(lastAutoBackup.value);
  }
});

function formatDurationMs(ms: number) {
  if (ms <= 0) return 'due now';
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const parts: string[] = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (parts.length === 0) parts.push(`${totalSec}s`);
  return parts.join(' ');
}

const nextInText = computed(() => {
  if (!autoBackupEnabled.value) return 'disabled';
  const periodMin = getAutoPeriodMinutes();
  const periodMs = periodMin * 60 * 1000;
  if (!lastAutoBackup.value) return `in ${formatDurationMs(periodMs)}`;
  const nextTs = lastAutoBackup.value + periodMs;
  const diff = nextTs - now.value;
  if (diff <= 0) return 'due now';
  return `in ${formatDurationMs(diff)}`;
});

function normalizePrefix(name: string) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function loadSettings(): Promise<void> {
  devicesRegistryLoaded.value = false;
  try {
    await maybeSeedOwnDeviceNameFromHost();
    const data = await loadCo21Settings();
    const suggestedHost = await getSuggestedHostDeviceLabel();
    let storedName =
      typeof data.ownDeviceName === 'string' ? data.ownDeviceName.trim() : '';
    if (!storedName) {
      storedName = suggestedHost || '';
    }
    ownDeviceName.value = storedName;
    savedOwnDeviceName.value = storedName;
    ownDeviceNameFromHost.value =
      !!storedName &&
      !!suggestedHost &&
      storedName.toLowerCase() === suggestedHost.toLowerCase();
    ownDeviceNameShowSaved.value = false;
    if (typeof data.autoBackupEnabled === 'boolean') {
      autoBackupEnabled.value = data.autoBackupEnabled;
    }
    if (typeof data.autoBackupHours === 'number') autoBackupHours.value = data.autoBackupHours;
    if (typeof data.autoBackupMinutes === 'number') {
      autoBackupMinutes.value = data.autoBackupMinutes;
    }
    if (typeof data.lastAutoBackup === 'number') lastAutoBackup.value = data.lastAutoBackup;
    await reloadDevicesFromSettings();
  } catch (e) {
    logger.error('loadSettings failed', e);
  } finally {
    devicesRegistryLoaded.value = true;
  }
}

/**
 * Load group files from the app data `storage/group` directory and return as array
 */
async function loadGroupsFromAppData(): Promise<any[]> {
  try {
    const api = (window as any).electronAPI;
    if (api && typeof api.getAppDataPath === 'function') {
      const appPath = await api.getAppDataPath();
      const groupDir = api.joinPath(appPath, 'storage', 'group');
      await api.ensureDir(groupDir);
      const groups: any[] = [];
      const files: string[] = await api.readDir(groupDir);
      for (const f of files || []) {
        if (typeof f === 'string' && f.startsWith('group-') && f.endsWith('.json')) {
          try {
            const p = api.joinPath(groupDir, f);
            const data = await api.readJsonFile(p);
            groups.push(data);
          } catch (e) {
            logger.error('Error reading group file', f, e);
          }
        }
      }
      return groups;
    }
    const stored = localStorage.getItem('day-organiser-groups');
    if (stored) {
      try { return JSON.parse(stored); } catch { return []; }
    }
    return [];
  } catch (e) {
    logger.error('loadGroupsFromAppData failed', e);
    return [];
  }
}

async function saveDevicesToStorage(): Promise<boolean> {
  if (!devicesRegistryLoaded.value) return false;
  try {
    // Device list only — never bundle ownDeviceName (that was wiping the saved label).
    return await saveConnectionsRegistry(devices.value);
  } catch (e) {
    logger.error('saveDevicesToStorage failed', e);
    return false;
  }
}

async function saveBackupSettings(): Promise<boolean> {
  try {
    return await saveConnectionsBackupSettings({
      autoBackupEnabled: !!autoBackupEnabled.value,
      autoBackupHours: Number(autoBackupHours.value || 0),
      autoBackupMinutes: Number(autoBackupMinutes.value || 0),
      lastAutoBackup: lastAutoBackup.value,
    });
  } catch (e) {
    logger.error('saveBackupSettings failed', e);
    return false;
  }
}

async function onOwnDeviceNameBlur(): Promise<void> {
  if (!devicesRegistryLoaded.value || !ownDeviceNameDirty.value) return;
  await saveOwnDeviceName();
}

async function saveOwnDeviceName() {
  if (!ownDeviceNameDirty.value || ownDeviceNameSaving.value) return;
  const trimmed = ownDeviceName.value.trim();
  if (!trimmed) {
    toast('warning', $text('connections.device_name_required'));
    return;
  }
  ownDeviceNameSaving.value = true;
  try {
    const ok = await saveOwnDeviceNameSetting(trimmed);
    if (ok) {
      savedOwnDeviceName.value = trimmed;
      ownDeviceNameShowSaved.value = true;
      const ownName = trimmed || (await loadOwnDeviceMeta()).name;
      devices.value = await refreshLanServerForConnections(devices.value, ownName);
    } else {
      toast('negative', 'Failed to save device name');
    }
  } finally {
    ownDeviceNameSaving.value = false;
  }
}

function openLanPairingWithOffer(detail: LanPendingDetail | null): void {
  if (detail) stashLanPendingOffer(detail);
  lanPairingPendingOffer.value = detail;
  dialogVisible.value = true;
  openAddConnectionDialog('lan');
}

function onLanPairingPendingEvent(ev: Event): void {
  const ce = ev as CustomEvent<Record<string, unknown>>;
  const detail = ce.detail ? parseLanPendingDetail(ce.detail) : null;
  if (!detail) return;
  openLanPairingWithOffer(detail);
}

async function reloadDevicesFromSettings(): Promise<void> {
  devices.value = await loadConnectionsDevices();
}

watch(dialogVisible, (open) => {
  if (open) {
    void refreshIncomingContractNotice();
    const pending = peekLanPendingOffer();
    if (pending) {
      lanPairingPendingOffer.value = pending;
      openAddConnectionDialog('lan');
    }
    void loadSettings().then(async () => {
      await refreshRoleProfiles();
      await captureBaseline();
      await refreshPendingSend();
      const ownName = ownDeviceName.value.trim() || (await loadOwnDeviceMeta()).name;
      devices.value = await refreshLanServerForConnections(devices.value, ownName);
    });
  }
});

watch(showJoinMemberDialog, (open) => {
  if (!open && dialogVisible.value) {
    void loadSettings().then(async () => {
      await refreshRoleProfiles();
      await captureBaseline();
    });
  }
});

function onRolesSavedForSync(): void {
  if (dialogVisible.value) void refreshRoleProfiles();
}

onMounted(() => {
  void loadSettings();
  window.addEventListener(LAN_PAIRING_PENDING_EVENT, onLanPairingPendingEvent as EventListener);
  window.addEventListener(LAN_PAIRED_EVENT, onLanPairedEvent as EventListener);
  window.addEventListener('co21:open-roles-setup', onOpenRolesSetup as EventListener);
  window.addEventListener('co21:sync-contract-signed', () => {
    void captureBaseline();
    void refreshPendingSend();
  });
  window.addEventListener('co21:roles-saved', onRolesSavedForSync as EventListener);
  // start periodic check for automatic backups
  autoTimerId.value = setInterval(() => {
    now.value = Date.now();
    void checkAutoBackup();
  }, 60 * 1000);
});

onBeforeUnmount(() => {
  window.removeEventListener(LAN_PAIRING_PENDING_EVENT, onLanPairingPendingEvent as EventListener);
  window.removeEventListener(LAN_PAIRED_EVENT, onLanPairedEvent as EventListener);
  window.removeEventListener('co21:open-roles-setup', onOpenRolesSetup as EventListener);
  window.removeEventListener('co21:roles-saved', onRolesSavedForSync as EventListener);
  if (autoTimerId.value) clearInterval(autoTimerId.value);
});

async function onLanPairedFromModal(_payload: LanPairedDevicePayload): Promise<void> {
  await reloadDevicesFromSettings();
  lanPairingPendingOffer.value = null;
  clearLanPendingOffer();
}

function onLanPairedEvent(): void {
  void reloadDevicesFromSettings();
}

watch([autoBackupEnabled, autoBackupHours, autoBackupMinutes], () => {
  if (!devicesRegistryLoaded.value) return;
  void saveBackupSettings();
});

function toast(type: 'positive' | 'negative' | 'info' | 'warning', message: string): void {
  appNotify(type, message, { position: 'bottom', timeout: 3000 });
}

const exportState = ref<'idle' | 'exporting' | 'done' | 'error'>('idle');
const exportMessage = ref<string>('');

const exportWithPicker = async () => {
  try {
    const api = (window as any).electronAPI;
    const folder = typeof api.showOpenFolder === 'function' ? await api.showOpenFolder() : null;
    if (!folder) return; // user cancelled

    const prefix = ownDeviceName.value ? normalizePrefix(ownDeviceName.value) : 'co21-backup';
    const name = `${prefix}-${new Date().toISOString().replace(/[:.]/g, '-')}.zip`;
    const full = api.joinPath(folder, name);

    exportState.value = 'exporting';
    exportMessage.value = 'Exporting...';

    // ensure directory exists and create zip archive containing groups from app data
    await api.ensureDir(folder);
    const groups = await loadGroupsFromAppData();
    const jsonString = JSON.stringify({ groups: Array.isArray(groups) ? groups : [] }, null, 2);
    await api.exportZip(folder, name, jsonString);

    exportState.value = 'done';
    exportMessage.value = 'Exported';
    setTimeout(() => {
      exportState.value = 'idle';
      exportMessage.value = '';
    }, 3500);
  } catch (e: any) {
    exportState.value = 'error';
    exportMessage.value = 'Export failed';
    setTimeout(() => {
      exportState.value = 'idle';
      exportMessage.value = '';
    }, 5000);
  }
};

async function exportAsJsonDownload(): Promise<void> {
  try {
    exportState.value = 'exporting';
    exportMessage.value = 'Exporting...';
    const groups = await loadGroupsFromAppData();
    const payload = JSON.stringify({ groups: Array.isArray(groups) ? groups : [] }, null, 2);
    const prefix = ownDeviceName.value ? normalizePrefix(ownDeviceName.value) : 'co21-backup';
    const name = `${prefix}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const blob = new Blob([payload], { type: 'application/json' });
    const file = new File([blob], name, { type: 'application/json' });

    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: 'CO21 Backup' });
      exportState.value = 'done';
      exportMessage.value = 'Shared successfully';
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      exportState.value = 'done';
      exportMessage.value = `Exported as ${name}`;
    }
    setTimeout(() => { exportState.value = 'idle'; exportMessage.value = ''; }, 4000);
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      exportState.value = 'idle';
      exportMessage.value = '';
      return;
    }
    exportState.value = 'error';
    exportMessage.value = `Export failed: ${e?.message || e}`;
    setTimeout(() => { exportState.value = 'idle'; exportMessage.value = ''; }, 5000);
  }
}

const triggerImport = () => {
  const el = fileInput.value;
  if (el) {
    el.value = '';
    el.click();
  }
};

function onAutoToggle(v: boolean) {
  // when enabling, set last auto backup time to now to avoid immediate run
  if (v) lastAutoBackup.value = Date.now();
  void saveBackupSettings();
}

function getAutoPeriodMinutes() {
  const total = Number(autoBackupHours.value || 0) * 60 + Number(autoBackupMinutes.value || 0);
  return Math.max(1, Math.floor(total));
}

async function performAutoBackup() {
  if (!hasElectronAPI) return;
  try {
    autoBackupStatus.value = 'exporting';
    const api = (window as any).electronAPI;
    const appPath = typeof api.getAppDataPath === 'function' ? await api.getAppDataPath() : null;
    if (!appPath) {
      autoBackupStatus.value = 'no app path';
      return;
    }
    const backupsDir = api.joinPath(appPath, 'co21', 'backups');
    await api.ensureDir(backupsDir);
    const prefix = ownDeviceName.value ? normalizePrefix(ownDeviceName.value) : 'co21-backup';
    const name = `${prefix}-auto-${new Date().toISOString().replace(/[:.]/g, '-')}.zip`;
    // read groups from app data storage and export those
    const groups = await loadGroupsFromAppData();
    const jsonString = JSON.stringify({ groups: Array.isArray(groups) ? groups : [] }, null, 2);
    await api.exportZip(backupsDir, name, jsonString);
    lastAutoBackup.value = Date.now();
    await saveBackupSettings();
    autoBackupStatus.value = 'done';
  } catch (e: any) {
    autoBackupStatus.value = 'error';
  }
}

async function checkAutoBackup() {
  try {
    if (!autoBackupEnabled.value) return;
    const period = getAutoPeriodMinutes();
    const now = Date.now();
    if (!lastAutoBackup.value) {
      // initialize last run to now and skip immediate backup
      lastAutoBackup.value = now;
      await saveBackupSettings();
      return;
    }
    const elapsedMin = (now - lastAutoBackup.value) / 60000;
    if (elapsedMin >= period) {
      await performAutoBackup();
    }
  } catch (e) {
    logger.error('checkAutoBackup failed', e);
  }
}

const overrideBackup = () => {
  try {
    // Show a dialog with only a cancel/close option to indicate feature isn't ready
    if ($q && typeof ($q.dialog as any) === 'function') {
      ($q.dialog as any)({
        title: 'Override connections',
        message: "Override functionality isn't ready; it will be implemented if needed.",
        cancel: true,
        ok: false,
        persistent: true,
      });
      return;
    }
    toast('info', "Override functionality isn't ready; it will be implemented if needed");
  } catch (e) {
    logger.error('overrideBackup failed', e);
    try {
      toast('negative', 'Override cancelled');
    } catch (ee) {
      logger.error('notify negative failed', ee);
    }
  }
};

const onFileSelected = (e: Event) => {
  const input = e.target as HTMLInputElement;
  if (!input.files || input.files.length === 0) return;
  const file = input.files[0];
  const reader = new FileReader();
  reader.onload = () => {
    try {
      let txt = '';
      if (typeof reader.result === 'string') {
        txt = reader.result;
      } else if (reader.result instanceof ArrayBuffer) {
        txt = new TextDecoder().decode(new Uint8Array(reader.result));
      } else if (reader.result) {
        try {
          txt = String(reader.result);
        } catch (ee) {
          txt = '';
        }
      }
      const parsed = JSON.parse(txt || '{}');
      if (parsed && Array.isArray(parsed.devices)) {
        devices.value = parsed.devices.map((d: unknown) =>
          parseConnectedDevice(d as Record<string, unknown>),
        );
        void saveDevicesToStorage();
        toast('positive', 'Imported connections');
      } else {
        toast('negative', 'Invalid backup format');
      }
    } catch (err: any) {
      toast('negative', `Import error: ${err?.message || err}`);
    }
  };
  if (file) reader.readAsText(file);
};

function onDeviceSelected(device: any) {
  // device expected to contain { id, name, ... }
  if (!device || !device.id) {
    toast('negative', 'Invalid device selected');
    return;
  }
  devices.value.push({ id: device.id, name: device.name || device.id, type: 'Bluetooth' });
  void saveDevicesToStorage();
  toast('positive', `Added device ${device.name || device.id}`);
}

</script>

<style scoped></style>

<style scoped>
:deep(.connections-menu) {
  z-index: 20020 !important;
}

:deep(.connections-menu .q-menu__content) {
  z-index: 20020 !important;
}

/* Force readable popup background and text color in case global theme overrides them */
:deep(.connections-menu > div) {
  background: var(--q-popup-bg, #ffffff) !important;
  color: var(--q-default-text, #000000) !important;
  -webkit-font-smoothing: antialiased;
}

:deep(.connections-menu .q-item),
:deep(.connections-menu .q-item-type) {
  color: var(--q-default-text, #000000) !important;
}

/* Custom inline menu items styling */
.connections-menu .q-item {
  padding: 8px 12px;
}

.connections-menu .q-item:hover {
  background: rgba(0, 0, 0, 0.04);
}

/* Inactive (disabled) inline menu items: visually muted and not interactive */
.connections-menu .inactive {
  opacity: 0.56;
  cursor: not-allowed;
  pointer-events: none;
}

/* No custom toggle styling — use theme defaults */
</style>
