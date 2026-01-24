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

        <q-list bordered>
          <q-item v-for="d in devices" :key="d.id" clickable @click="connect(d)">
            <q-item-section avatar style="width: 36px">
              <q-icon name="bluetooth_searching" />
            </q-item-section>
            <q-item-section>
              <div>{{ d.name }}</div>
              <div class="text-caption text-grey">{{ d.info }}</div>
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
const devices = ref<Array<{ id: string; name: string; info?: string }>>([]);
let removeDiscoveredListener: (() => void) | null = null;
let webScanStopper: (() => Promise<void>) | null = null;
const webBluetoothAvailable = !!(window as any).electronBLE?.webBluetoothAvailable;

async function startScan() {
  devices.value = [];
  scanning.value = true;

  const ble = (window as any).electronBLE;
  // Prefer Web Bluetooth in renderer when available
  if (webBluetoothAvailable) {
    try {
      if (typeof ble.startScanWeb === 'function') {
        // startScanWeb will call onDiscovered for each advertisement and return a stopper
        webScanStopper = await ble.startScanWeb((payload: any) => {
          devices.value.push({
            id: payload.id,
            name: payload.name || payload.id,
            info: `RSSI ${payload.rssi ?? ''}`,
          });
        });
        scanning.value = true;
        return;
      }

      // Fallback to user chooser which returns a single device
      if (typeof ble.requestDevice === 'function') {
        const dev = await ble.requestDevice({ acceptAllDevices: true });
        devices.value.push({ id: dev.id, name: dev.name || dev.id, info: 'Web Bluetooth device' });
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
      devices.value.push({
        id: payload.id,
        name: payload.name || payload.id,
        info: `RSSI ${payload.rssi ?? ''}`,
      });
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
    devices.value.push({ id: 'dev1', name: 'Community Speaker', info: 'BLE • RSSI -42' });
    devices.value.push({ id: 'dev2', name: 'Entrance Beacon', info: 'BLE • RSSI -61' });
    scanning.value = false;
  }, 900);
}

async function stopScan() {
  const ble = (window as any).electronBLE;
  if (webScanStopper) {
    try {
      await webScanStopper();
    } catch (e) {
      /* ignore */
    }
    webScanStopper = null;
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
