<template>
  <q-dialog v-model="dialogVisible">
    <q-card style="min-width: 420px; max-width: 90vw">
      <q-card-section>
        <div class="text-h6">Connections and data</div>
        <div class="q-mt-sm">
          <q-input dense outlined v-model="ownDeviceName" label="Your device name" />
        </div>
      </q-card-section>

      <q-card-section class="q-pt-sm">
        <div class="q-gutter-md">
          <div class="text-subtitle2 q-mb-sm">Manage external connections and integrations</div>
          <div class="row items-center q-gutter-sm">
            <div class="col">No devices configured.</div>
            <div class="col-auto" style="position: relative">
              <q-btn ref="addBtn" dense label="Add Device" color="primary" @click="openAddMenu" />

              <div v-if="addMenu" :style="addMenuStyle" class="connections-menu use-default">
                <div
                  style="
                    padding: 6px 0;
                    width: 220px;
                    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.12);
                    background: var(--q-popup-bg, #fff);
                    border-radius: 6px;
                  "
                >
                  <div class="q-list">
                    <q-item
                      clickable
                      role="button"
                      @click="createDevice('Bluetooth')"
                      style="padding: 8px 12px; cursor: pointer"
                    >
                      <q-item-section avatar style="width: 32px">
                        <q-icon name="bluetooth" />
                      </q-item-section>
                      <q-item-section>Bluetooth</q-item-section>
                    </q-item>

                    <q-item class="inactive" aria-disabled="true" style="padding: 8px 12px">
                      <q-item-section avatar style="width: 32px">
                        <q-icon name="wifi" />
                      </q-item-section>
                      <q-item-section>Wi‑Fi area / LAN</q-item-section>
                    </q-item>

                    <q-item class="inactive" aria-disabled="true" style="padding: 8px 12px">
                      <q-item-section avatar style="width: 32px">
                        <q-icon name="cloud" />
                      </q-item-section>
                      <q-item-section>Internet</q-item-section>
                    </q-item>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="q-mt-md">
            <q-item v-for="d in devices" :key="d.id">
              <q-item-section>
                <div class="row items-center">
                  <div class="col">
                    {{ d.name }}
                    <span class="text-caption text-grey-7 q-ml-sm">({{ d.type }})</span>
                  </div>
                  <div class="col-auto">
                    <q-btn dense flat label="Connect" color="primary" @click="connectDevice(d)" />
                    <q-btn dense flat icon="delete" color="negative" @click="removeDevice(d.id)" />
                  </div>
                </div>
              </q-item-section>
            </q-item>
          </div>
          <div class="q-mt-md">
            <div class="text-subtitle2 q-mb-sm">Backup</div>
            <div class="row items-center q-gutter-sm">
              <div class="col">
                Make manual backup, merge current state with data from file, or totally replace
                current data with data from file
              </div>
              <div
                class="col-auto"
                style="
                  display: flex;
                  flex-direction: column;
                  align-items: flex-end;
                  justify-content: center;
                "
              >
                <div style="display: flex; align-items: center">
                  <q-btn
                    dense
                    unelevated
                    color="primary"
                    label="Export"
                    class="q-mr-sm"
                    @click="exportWithPicker"
                  />
                  <q-btn
                    dense
                    outline
                    color="secondary"
                    label="Merge"
                    class="q-mr-sm"
                    @click="triggerImport"
                  />
                  <q-btn
                    dense
                    unelevated
                    color="negative"
                    label="Override"
                    class="q-ml-sm"
                    @click="overrideBackup"
                  />
                </div>
                <div
                  v-if="exportState !== 'idle'"
                  style="margin-top: 6px; width: 100%; text-align: left"
                >
                  <div class="text-caption" style="display: flex; align-items: center; gap: 8px">
                    <q-spinner v-if="exportState === 'exporting'" size="18" />
                    <q-icon
                      v-else-if="exportState === 'done'"
                      name="check"
                      color="positive"
                      size="18"
                    />
                    <q-icon
                      v-else-if="exportState === 'error'"
                      name="error"
                      color="negative"
                      size="18"
                    />
                    <span>{{ exportMessage }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="q-mt-md">
            <div class="row items-center q-gutter-sm">
              <div class="col">
                Automatic local backup

                <q-toggle
                  class="q-ml-sm"
                  dense
                  v-model="autoBackupEnabled"
                  @update:model-value="onAutoToggle"
                />
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
          <div class="q-mt-md">
            <div class="text-subtitle2 q-mb-sm">Internet services</div>
            <div class="row items-center q-gutter-sm">
              <div class="col text-white">
                <div
                  class="text-caption text-white q-mt-xs"
                  style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis"
                >
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
                <q-btn
                  dense
                  outline
                  color="primary"
                  label="Manage"
                  @click="() => notify('info', 'Internet settings not implemented')"
                />
              </div>
            </div>
          </div>
        </div>
      </q-card-section>

      <q-card-actions align="right">
        <q-space />
        <q-btn dense flat label="Close" color="primary" @click="close" />
      </q-card-actions>
      <input
        ref="fileInput"
        type="file"
        accept="application/json"
        style="display: none"
        @change="onFileSelected"
      />
    </q-card>
    <BluetoothScanModal v-model:modelValue="showScanModal" @connect="onDeviceSelected" />
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, onBeforeUnmount } from 'vue';
import { useQuasar, Notify } from 'quasar';
import logger from 'src/utils/logger';
import BluetoothScanModal from './BluetoothScanModal.vue';

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>();

const dialogVisible = computed({
  get: () => !!props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
});

const devices = ref<Array<{ id: string; name: string; type?: string }>>([]);
const addMenu = ref(false);
const addBtn = ref<any>(null);
const addMenuStyle = ref<Record<string, string>>({
  position: 'fixed',
  left: '0px',
  top: '0px',
  zIndex: '20020',
});

function createDevice(type: string) {
  // For Bluetooth, open the scanner modal so user can choose a device
  if (type === 'Bluetooth') {
    showScanModal.value = true;
    addMenu.value = false;
    return;
  }
  const id = String(Date.now());
  devices.value.push({ id, name: `${type} Device ${devices.value.length + 1}`, type });
  addMenu.value = false;
}

function openAddMenu() {
  try {
    const el = addBtn.value;
    let dom: HTMLElement | null = null;
    if (!el) {
      dom = null;
    } else if (el.$el && typeof el.$el.getBoundingClientRect === 'function') {
      dom = el.$el as HTMLElement;
    } else if (typeof el.getBoundingClientRect === 'function') {
      dom = el as HTMLElement;
    }

    if (!dom) {
      addMenuStyle.value = { position: 'fixed', left: '8px', top: '8px', zIndex: '20020' };
      addMenu.value = true;
      return;
    }
    const r = dom.getBoundingClientRect();
    const width = 220;
    const left = Math.min(Math.max(8, r.right - width), window.innerWidth - width - 8);
    const top = Math.min(window.innerHeight - 40, r.bottom + 6);
    addMenuStyle.value = { position: 'fixed', left: `${left}px`, top: `${top}px`, zIndex: '20020' };
    addMenu.value = true;
  } catch (e) {
    addMenu.value = true;
  }
}

function removeDevice(id: string) {
  devices.value = devices.value.filter((d) => d.id !== id);
}

function close() {
  dialogVisible.value = false;
}

// Scan modal handling
const $q = useQuasar();
const showScanModal = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);
const ownDeviceName = ref<string>('');

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

async function loadSettings() {
  try {
    const api = (window as any).electronAPI;
    const appPath = typeof api.getAppDataPath === 'function' ? await api.getAppDataPath() : null;
    if (!appPath) return;
    const settingsDir = api.joinPath(appPath, 'co21');
    const settingsFile = api.joinPath(settingsDir, 'settings.json');
    const exists = await api.fileExists(settingsFile);
    if (!exists) return;
    const data = await api.readJsonFile(settingsFile);
    if (data) {
      if (typeof data.ownDeviceName === 'string') ownDeviceName.value = data.ownDeviceName;
      if (typeof data.autoBackupEnabled === 'boolean')
        autoBackupEnabled.value = data.autoBackupEnabled;
      if (typeof data.autoBackupHours === 'number') autoBackupHours.value = data.autoBackupHours;
      if (typeof data.autoBackupMinutes === 'number')
        autoBackupMinutes.value = data.autoBackupMinutes;
      if (typeof data.lastAutoBackup === 'number') lastAutoBackup.value = data.lastAutoBackup;
    }
  } catch (e) {
    logger.error('loadSettings failed', e);
  }
}

/**
 * Load group files from the app data `storage/group` directory and return as array
 */
async function loadGroupsFromAppData(): Promise<any[]> {
  try {
    const api = (window as any).electronAPI;
    if (!api || typeof api.getAppDataPath !== 'function') return [];
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
  } catch (e) {
    logger.error('loadGroupsFromAppData failed', e);
    return [];
  }
}

async function saveSettings() {
  try {
    const api = (window as any).electronAPI;
    const appPath = typeof api.getAppDataPath === 'function' ? await api.getAppDataPath() : null;
    if (!appPath) return;
    const settingsDir = api.joinPath(appPath, 'co21');
    const settingsFile = api.joinPath(settingsDir, 'settings.json');
    await api.ensureDir(settingsDir);
    const payload: any = {
      ownDeviceName: ownDeviceName.value || '',
      autoBackupEnabled: !!autoBackupEnabled.value,
      autoBackupHours: Number(autoBackupHours.value || 0),
      autoBackupMinutes: Number(autoBackupMinutes.value || 0),
    };
    if (lastAutoBackup.value) payload.lastAutoBackup = lastAutoBackup.value;
    await api.writeJsonFile(settingsFile, payload);
  } catch (e) {
    logger.error('saveSettings failed', e);
  }
}

onMounted(() => {
  loadSettings();
  // start periodic check for automatic backups
  autoTimerId.value = setInterval(() => {
    now.value = Date.now();
    void checkAutoBackup();
  }, 60 * 1000);
});

onBeforeUnmount(() => {
  if (autoTimerId.value) clearInterval(autoTimerId.value);
});

watch(ownDeviceName, (val) => {
  void saveSettings();
});
watch([autoBackupEnabled, autoBackupHours, autoBackupMinutes], () => {
  void saveSettings();
});

function notify(type: 'positive' | 'negative' | 'info' | 'warning', message: string) {
  try {
    if (typeof (Notify as any)?.create === 'function') {
      (Notify as any).create({ type, message });
      return;
    }
  } catch (e) {
    logger.error('notify: Notify.create failed', e);
  }
  try {
    if ($q && typeof ($q.notify as any) === 'function') {
      ($q.notify as any)({ type, message });
      return;
    }
  } catch (e) {
    logger.error('notify: $q.notify failed', e);
  }
  try {
    // last resort
    alert(message);
  } catch (e) {
    logger.error('notify: alert fallback failed', e);
  }
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
  void saveSettings();
}

function getAutoPeriodMinutes() {
  const total = Number(autoBackupHours.value || 0) * 60 + Number(autoBackupMinutes.value || 0);
  return Math.max(1, Math.floor(total));
}

async function performAutoBackup() {
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
    await saveSettings();
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
      await saveSettings();
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
    notify('info', "Override functionality isn't ready; it will be implemented if needed");
  } catch (e) {
    logger.error('overrideBackup failed', e);
    try {
      notify('negative', 'Override cancelled');
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
        devices.value = parsed.devices.map((d: any) => ({
          id: String(d.id),
          name: String(d.name || d.id),
          type: d.type || 'imported',
        }));
        notify('positive', 'Imported connections');
      } else {
        notify('negative', 'Invalid backup format');
      }
    } catch (err: any) {
      notify('negative', `Import error: ${err?.message || err}`);
    }
  };
  if (file) reader.readAsText(file);
};

function onDeviceSelected(device: any) {
  // device expected to contain { id, name, ... }
  if (!device || !device.id) {
    notify('negative', 'Invalid device selected');
    return;
  }
  devices.value.push({ id: device.id, name: device.name || device.id, type: 'Bluetooth' });
  showScanModal.value = false;
  notify('positive', `Added device ${device.name || device.id}`);
}

async function connectDevice(d: any) {
  try {
    notify('info', `Connecting to ${d.name}...`);
    const ble = (window as any).electronBLE;
    if (ble && typeof ble.connect === 'function') {
      const res = await ble.connect(d.id);
      if (res && res.status === 'connected') {
        notify('positive', `Connected to ${d.name}`);
      } else if (res && res.error) {
        notify('negative', `Connect failed: ${res.error}`);
      } else {
        notify('positive', `Connect result: ${JSON.stringify(res)}`);
      }
    } else {
      notify('warning', 'BLE connect not available in this runtime');
    }
  } catch (e: any) {
    notify('negative', `Connect error: ${e?.message || e}`);
  }
}
</script>

<style scoped></style>

<style scoped>
::v-deep .connections-menu {
  z-index: 20020 !important;
}
::v-deep .connections-menu .q-menu__content {
  z-index: 20020 !important;
}

/* Force readable popup background and text color in case global theme overrides them */
::v-deep .connections-menu > div {
  background: var(--q-popup-bg, #ffffff) !important;
  color: var(--q-default-text, #000000) !important;
  -webkit-font-smoothing: antialiased;
}
::v-deep .connections-menu .q-item,
::v-deep .connections-menu .q-item-type {
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
