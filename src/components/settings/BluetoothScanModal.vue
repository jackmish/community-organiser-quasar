<template>
  <q-dialog v-model="visible">
    <q-card style="min-width: 360px; max-width: 640px">
      <q-card-section>
        <div class="text-h6">Scan for Bluetooth devices</div>
      </q-card-section>

      <q-card-section>
        <div class="q-mb-sm">Tap a device to connect (mock scanner).</div>

        <div style="display: flex; gap: 8px; margin-bottom: 8px">
          <q-btn dense unelevated color="primary" @click="startScan" label="Scan" />
          <q-btn dense flat color="secondary" @click="stopScan" label="Stop" />
          <q-space />
          <div class="text-caption">{{ scanning ? 'Scanning…' : '' }}</div>
        </div>

        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px">
          <q-checkbox v-model="showOnlyAppDevices" label="Show only Community Organiser devices" />
          <div class="text-caption">(devices advertising Community Organiser service UUID)</div>
        </div>

        <q-list bordered>
          <q-item
            v-for="d in devices.filter((x) => !showOnlyAppDevices || x.isApp)"
            :key="d.id"
            clickable
            @click="connect(d)"
          >
            <q-item-section avatar style="width: 36px">
              <q-icon name="bluetooth_searching" />
            </q-item-section>
            <q-item-section>
              <div>{{ d.name }}</div>
              <div class="text-caption text-grey">{{ d.info }}</div>
              <div v-if="d.isApp" class="text-caption text-positive">
                Community Organiser device
              </div>
            </q-item-section>
            <q-item-section side style="min-width: 80px">
              <q-btn dense color="primary" label="Connect" @click.stop.prevent="connect(d)" />
            </q-item-section>
          </q-item>
        </q-list>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Close" color="primary" @click="visible = false" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits(['update:modelValue', 'connect']);
const emitAny = emit as unknown as (...args: any[]) => void;

const visible = computed({
  get: () => !!props.modelValue,
  set: (v: boolean) => emitAny('update:modelValue', v),
});

const scanning = ref(false);
const devices = ref<
  Array<{ id: string; name: string; info?: string; isApp?: boolean; serviceUuids?: string[] }>
>([]);
const showOnlyAppDevices = ref(true);
const APP_NAME_PREFIX = 'CO21';
// Service UUID used to identify Community Organiser instances
const APP_SERVICE_UUID = '0000c021-0000-1000-8000-00805f9b34fb';
let removeDiscoveredListener: (() => void) | null = null;
const webBluetoothAvailable =
  !!(window as any).electronBLE &&
  typeof (window as any).electronBLE.webBluetoothAvailable === 'function' &&
  (window as any).electronBLE.webBluetoothAvailable();

async function startScan() {
  devices.value = [];
  scanning.value = true;

  const ble = (window as any).electronBLE;
  // Prefer Web Bluetooth in renderer when available
  if (webBluetoothAvailable) {
    try {
      // Listen for web-ble-device events dispatched from preload
      const handler = (ev: any) => {
        const payload = ev.detail || {};
        const name = payload.name || payload.id;
        const serviceUuids = Array.isArray(payload.serviceUuids)
          ? payload.serviceUuids.map((s: any) => String(s))
          : [];
        const manufacturerData = payload.manufacturerData || {};

        // Detection priority: service UUID match -> manufacturer marker -> name prefix
        const isApp =
          (serviceUuids &&
            serviceUuids
              .map((s: string) => s.toLowerCase())
              .includes(APP_SERVICE_UUID.toLowerCase())) ||
          Object.values(manufacturerData).some((v: unknown) => {
            if (typeof v === 'string') return v.toLowerCase().includes('c021');
            if (typeof v === 'number') return String(v).toLowerCase().includes('c021');
            if (v instanceof Uint8Array) {
              const hex = Array.from(v)
                .map((b) => b.toString(16).padStart(2, '0'))
                .join('');
              return hex.includes('c021');
            }
            // handle ArrayBuffer-like objects
            if (v && typeof v === 'object' && ('buffer' in v || 'byteLength' in v)) {
              try {
                const arr = new Uint8Array((v as any).buffer || (v as any));
                const hex = Array.from(arr)
                  .map((b) => b.toString(16).padStart(2, '0'))
                  .join('');
                return hex.includes('c021');
              } catch (e) {
                return false;
              }
            }
            return false;
          }) ||
          (typeof name === 'string' && name.startsWith(APP_NAME_PREFIX));

        devices.value.push({
          id: payload.id,
          name,
          info: `RSSI ${payload.rssi ?? ''}`,
          isApp,
          serviceUuids,
        });
      };

      window.addEventListener('web-ble-device', handler as EventListener);
      removeDiscoveredListener = () =>
        window.removeEventListener('web-ble-device', handler as EventListener);

      // start scanning for our service UUID
      if (typeof ble.startScanWeb === 'function') {
        await ble.startScanWeb(APP_SERVICE_UUID);
        scanning.value = true;
        return;
      }

      // Fallback to requestDevice filtered by service UUID
      if (typeof ble.requestDevice === 'function') {
        const dev = await ble.requestDevice(APP_SERVICE_UUID);
        if (dev) {
          const name = dev.name || dev.id;
          const devUuids = Array.isArray(dev.uuids) ? dev.uuids.map((s: any) => String(s)) : [];
          const isApp =
            devUuids.map((s: string) => s.toLowerCase()).includes(APP_SERVICE_UUID.toLowerCase()) ||
            (typeof name === 'string' && name.startsWith(APP_NAME_PREFIX));
          devices.value.push({
            id: dev.id,
            name,
            info: 'Web Bluetooth device',
            isApp,
            serviceUuids: devUuids,
          });
        }
        scanning.value = false;
        return;
      }
    } catch (e) {
      console.error('Web Bluetooth scan error', e);
    }
  }

  if (ble && typeof ble.startScan === 'function') {
    // subscribe to discovered events
    removeDiscoveredListener = ble.onDeviceDiscovered((payload: any) => {
      const name = payload.name || payload.id;
      const isApp = typeof name === 'string' && name.startsWith(APP_NAME_PREFIX);
      devices.value.push({ id: payload.id, name, info: `RSSI ${payload.rssi ?? ''}`, isApp });
    });
    try {
      await ble.startScan();
    } catch (e) {
      console.error('ble.startScan error', e);
    }
    scanning.value = true;
    return;
  }

  // Fallback mock discovered devices
  setTimeout(() => {
    devices.value.push({
      id: 'dev1',
      name: 'CO21 Speaker',
      info: 'BLE • RSSI -42',
      isApp: true,
      serviceUuids: [APP_SERVICE_UUID],
    });
    devices.value.push({
      id: 'dev2',
      name: 'Entrance Beacon',
      info: 'BLE • RSSI -61',
      isApp: false,
      serviceUuids: [],
    });
    scanning.value = false;
  }, 900);
}

async function stopScan() {
  const ble = (window as any).electronBLE;
  if (webBluetoothAvailable && typeof ble.stopScanWeb === 'function') {
    try {
      await ble.stopScanWeb();
    } catch (e) {
      /* ignore */
    }
  }
  if (ble && typeof ble.stopScan === 'function') {
    try {
      await ble.stopScan();
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

function connect(d: any) {
  emitAny('connect', d);
  visible.value = false;
}
</script>

<style scoped></style>
