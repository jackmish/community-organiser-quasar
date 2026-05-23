<template>
  <div class="bluetooth-scan-panel">
    <div v-if="!bluetoothConnectionEnabled" class="text-body2 text-grey-8 q-pa-sm">
      {{ $text('connections.bluetooth_disabled') }}
    </div>
    <template v-else>
      <div class="row q-gutter-sm q-mb-sm items-center">
        <q-btn dense unelevated color="primary" icon="bluetooth_searching" label="Scan" @click="startScan" />
        <q-btn dense flat color="secondary" label="Stop" @click="stopScan" />
        <q-space />
        <span class="text-caption text-grey-7">{{ scanning ? 'Scanning…' : '' }}</span>
      </div>

      <q-checkbox
        v-model="showOnlyAppDevices"
        dense
        :label="$text('connections.bluetooth_app_only')"
        class="q-mb-sm"
      />

      <q-list bordered class="rounded-borders bluetooth-scan-list">
        <q-item
          v-for="d in devices.filter((x) => !showOnlyAppDevices || x.isApp)"
          :key="d.id"
          clickable
          @click="connect(d)"
        >
          <q-item-section avatar>
            <q-icon name="bluetooth" />
          </q-item-section>
          <q-item-section>
            <q-item-label>{{ d.name }}</q-item-label>
            <q-item-label v-if="d.info" caption>{{ d.info }}</q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-btn dense color="primary" label="Connect" @click.stop="connect(d)" />
          </q-item-section>
        </q-item>
        <q-item v-if="!devices.length && !scanning">
          <q-item-section class="text-caption text-grey-7">
            {{ $text('connections.bluetooth_scan_empty') }}
          </q-item-section>
        </q-item>
      </q-list>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue';
import { $text } from 'src/modules/lang';
import { BLUETOOTH_CONNECTION_ENABLED } from 'src/constants/connectionFeatures';

const props = withDefaults(
  defineProps<{
    active?: boolean;
  }>(),
  { active: true },
);

const emit = defineEmits<{
  (e: 'connect', device: { id: string; name: string }): void;
}>();

const bluetoothConnectionEnabled = BLUETOOTH_CONNECTION_ENABLED;
const scanning = ref(false);
const devices = ref<
  Array<{ id: string; name: string; info?: string; isApp?: boolean; serviceUuids?: string[] }>
>([]);
const showOnlyAppDevices = ref(true);
const APP_NAME_PREFIX = 'CO21';
const APP_SERVICE_UUID = '0000c021-0000-1000-8000-00805f9b34fb';
let removeDiscoveredListener: (() => void) | null = null;

function blePayloadString(v: unknown, fallback = ''): string {
  if (typeof v === 'string') return v;
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return fallback;
}

function deviceRowFromBlePayload(payload: Record<string, unknown>): {
  id: string;
  name: string;
  info: string;
  isApp: boolean;
} {
  const id = blePayloadString(payload.id);
  const name = blePayloadString(payload.name) || id;
  const rssi = blePayloadString(payload.rssi);
  const info = rssi ? `RSSI ${rssi}` : '';
  return {
    id: id || name,
    name: name || id,
    info,
    isApp: (name || id).startsWith(APP_NAME_PREFIX),
  };
}
const webBluetoothAvailable =
  !!(window as unknown as { electronBLE?: { webBluetoothAvailable?: () => boolean } }).electronBLE &&
  typeof (window as unknown as { electronBLE?: { webBluetoothAvailable?: () => boolean } })
    .electronBLE?.webBluetoothAvailable === 'function' &&
  (
    window as unknown as { electronBLE: { webBluetoothAvailable: () => boolean } }
  ).electronBLE.webBluetoothAvailable();

watch(
  () => props.active,
  (open) => {
    if (!open) void stopScan();
  },
);

onBeforeUnmount(() => {
  void stopScan();
});

async function startScan() {
  devices.value = [];
  scanning.value = true;

  const ble = (window as unknown as { electronBLE?: Record<string, unknown> }).electronBLE;
  if (webBluetoothAvailable && ble) {
    try {
      const handler = (ev: Event) => {
        const raw = (ev as CustomEvent).detail;
        const payload =
          raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
        const row = deviceRowFromBlePayload(payload);
        const serviceUuids = Array.isArray(payload.serviceUuids)
          ? payload.serviceUuids
              .map((s) => blePayloadString(s))
              .filter((s) => s.length > 0)
          : [];
        const manufacturerData = payload.manufacturerData;
        const hasManufacturerMarker =
          typeof manufacturerData === 'object' &&
          manufacturerData !== null &&
          !Array.isArray(manufacturerData) &&
          Object.values(manufacturerData as Record<string, unknown>).some(
            (v) => typeof v === 'string' && v.toLowerCase().includes('c021'),
          );
        const isApp =
          serviceUuids.map((s) => s.toLowerCase()).includes(APP_SERVICE_UUID.toLowerCase()) ||
          hasManufacturerMarker ||
          row.isApp;
        devices.value.push({ ...row, isApp, serviceUuids });
      };
      window.addEventListener('web-ble-device', handler as EventListener);
      removeDiscoveredListener = () =>
        window.removeEventListener('web-ble-device', handler as EventListener);
      if (typeof ble.startScanWeb === 'function') {
        await (ble.startScanWeb as (uuid: string) => Promise<void>)(APP_SERVICE_UUID);
        return;
      }
    } catch (e) {
      console.error('Web Bluetooth scan error', e);
    }
  }

  if (ble && typeof ble.startScan === 'function') {
    removeDiscoveredListener = (
      ble.onDeviceDiscovered as (cb: (payload: Record<string, unknown>) => void) => () => void
    )((payload) => {
      devices.value.push(deviceRowFromBlePayload(payload));
    });
    try {
      await (ble.startScan as () => Promise<void>)();
    } catch (e) {
      console.error('ble.startScan error', e);
    }
    return;
  }

  setTimeout(() => {
    devices.value.push({
      id: 'dev1',
      name: 'CO21 Speaker',
      info: 'BLE • RSSI -42',
      isApp: true,
    });
    scanning.value = false;
  }, 900);
}

async function stopScan() {
  const ble = (window as unknown as { electronBLE?: Record<string, unknown> }).electronBLE;
  if (webBluetoothAvailable && ble && typeof ble.stopScanWeb === 'function') {
    try {
      await (ble.stopScanWeb as () => Promise<void>)();
    } catch {
      void 0;
    }
  }
  if (ble && typeof ble.stopScan === 'function') {
    try {
      await (ble.stopScan as () => Promise<void>)();
    } catch (e) {
      console.error('ble.stopScan error', e);
    }
  }
  scanning.value = false;
  if (removeDiscoveredListener) {
    removeDiscoveredListener();
    removeDiscoveredListener = null;
  }
}

function connect(d: { id: string; name: string }) {
  emit('connect', { id: d.id, name: d.name });
}
</script>
