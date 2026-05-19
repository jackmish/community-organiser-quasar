<template>
  <q-dialog :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)">
    <q-card style="min-width: 360px; max-width: 92vw">
      <q-card-section>
        <div class="text-h6">Wi‑Fi / LAN pairing</div>
        <div class="text-caption text-grey-7 q-mt-xs">
          Phone and PC must be on the same network. Port {{ port }}.
        </div>
      </q-card-section>

      <q-card-section v-if="hasElectronLan" class="q-pt-none">
        <div class="text-subtitle2 q-mb-sm">On this computer</div>
        <q-toggle
          :model-value="listenOn"
          label="Accept pairing requests from the LAN"
          color="positive"
          @update:model-value="onToggleListen"
        />
        <div v-if="listenOn && serverAddrs.length" class="q-mt-sm text-body2">
          <div class="text-weight-medium">Use this address on your phone:</div>
          <div v-for="a in serverAddrs" :key="a" class="text-primary">{{ a }}:{{ port }}</div>
        </div>
        <div v-else-if="listenError" class="text-negative q-mt-sm text-caption">{{ listenError }}</div>
      </q-card-section>

      <q-separator v-if="hasElectronLan" />

      <q-card-section>
        <div class="text-subtitle2 q-mb-sm">From this device — pair with a PC</div>
        <q-input
          v-model="pcHost"
          dense
          outlined
          label="PC IP address (e.g. 192.168.1.10)"
          class="q-mb-sm"
        />
        <q-btn
          color="primary"
          unelevated
          label="Request pairing"
          :loading="pairBusy"
          :disable="!pcHost.trim()"
          @click="requestPairToPc"
        />
        <div v-if="pairHint" class="text-caption q-mt-sm" :class="pairHintClass">{{ pairHint }}</div>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Close" color="primary" @click="close" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { deviceId } from 'src/modules/storage/sync/deviceId';
import { CO21_LAN_PAIRING_PORT, co21LanBaseUrl } from 'src/modules/lan/lanPairingConstants';
import {
  lanFetchInfo,
  lanPostPairRequest,
  lanPollUntilResolved,
} from 'src/modules/lan/lanPairingClient';
import logger from 'src/utils/logger';

const props = defineProps<{
  modelValue: boolean;
  ownDeviceName: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
  (
    e: 'paired',
    payload: { id: string; name: string; type: string; lanHost: string; appVersion?: string },
  ): void;
}>();

const port = CO21_LAN_PAIRING_PORT;

const hasElectronLan = computed(
  () =>
    typeof window !== 'undefined' &&
    !!(window as unknown as { electronLan?: { startServer?: unknown } }).electronLan?.startServer,
);

const listenOn = ref(false);
const serverAddrs = ref<string[]>([]);
const listenError = ref('');

const pcHost = ref('');
const pairBusy = ref(false);
const pairHint = ref('');
const pairHintClass = ref('text-grey-7');

watch(
  () => props.modelValue,
  async (open) => {
    if (!open) {
      if (listenOn.value && hasElectronLan.value) {
        await stopListen();
      }
      pcHost.value = '';
      pairHint.value = '';
      return;
    }
    if (hasElectronLan.value) {
      void refreshStatus();
    }
  },
);

async function refreshStatus() {
  const elan = (window as unknown as { electronLan?: { status?: () => Promise<unknown> } }).electronLan;
  if (!elan?.status) return;
  try {
    const s = (await elan.status()) as { listening?: boolean; addresses?: string[] };
    listenOn.value = !!s.listening;
    serverAddrs.value = Array.isArray(s.addresses) ? s.addresses : [];
  } catch (e) {
    logger.warn('[LanPairingModal] status failed', e);
  }
}

async function stopListen() {
  const elan = (window as unknown as { electronLan?: { stopServer?: () => Promise<unknown> } }).electronLan;
  if (elan?.stopServer) await elan.stopServer();
  listenOn.value = false;
  serverAddrs.value = [];
  listenError.value = '';
}

async function onToggleListen(v: boolean) {
  listenError.value = '';
  const elan = (window as unknown as {
    electronLan?: {
      startServer?: (i: { deviceId: string; deviceName: string; appVersion: string }) => Promise<unknown>;
      stopServer?: () => Promise<unknown>;
    };
  }).electronLan;
  if (!elan) return;
  if (!v) {
    await stopListen();
    return;
  }
  try {
    const id = await deviceId.get();
    const ver =
      typeof (window as unknown as { APP_VERSION?: string }).APP_VERSION === 'string'
        ? String((window as unknown as { APP_VERSION?: string }).APP_VERSION)
        : '';
    const name = (props.ownDeviceName || '').trim() || 'This PC';
    const res = (await elan.startServer?.({
      deviceId: id,
      deviceName: name,
      appVersion: ver,
    })) as { ok?: boolean; addresses?: string[]; error?: string };
    if (res?.ok) {
      listenOn.value = true;
      serverAddrs.value = Array.isArray(res.addresses) ? res.addresses : [];
    } else {
      listenOn.value = false;
      listenError.value = res?.error || 'Could not start LAN server';
    }
  } catch (e: unknown) {
    listenOn.value = false;
    listenError.value = e instanceof Error ? e.message : String(e);
  }
}

async function requestPairToPc() {
  pairHint.value = '';
  pairBusy.value = true;
  try {
    const base = co21LanBaseUrl(pcHost.value.trim());
    const info = await lanFetchInfo(base);
    if (!info) {
      pairHint.value = 'Could not reach a CO21 app on that address.';
      pairHintClass.value = 'text-negative';
      return;
    }
    pairHint.value = `Found: ${info.deviceName} (${info.deviceId.slice(0, 8)}…)`;
    pairHintClass.value = 'text-grey-7';

    const myId = await deviceId.get();
    const myName = (props.ownDeviceName || '').trim() || 'Device';
    const myVer =
      typeof (window as unknown as { APP_VERSION?: string }).APP_VERSION === 'string'
        ? String((window as unknown as { APP_VERSION?: string }).APP_VERSION)
        : '';

    const req = await lanPostPairRequest(base, {
      deviceId: myId,
      deviceName: myName,
      appVersion: myVer,
    });
    if (!req) {
      pairHint.value = 'Pairing request was rejected or the PC is not accepting LAN pairing.';
      pairHintClass.value = 'text-negative';
      return;
    }

    pairHint.value = 'Waiting for someone on the PC to confirm…';
    const poll = await lanPollUntilResolved(base, req.token);
    if (poll.status === 'accepted' && poll.peer) {
      const trimmed = pcHost.value.trim();
      const noScheme = trimmed.replace(/^https?:\/\//i, '');
      const hostPart = noScheme.split('/')[0] ?? '';
      const hostOnly = (hostPart.split(':')[0] ?? '').trim() || 'unknown';
      const paired: {
        id: string;
        name: string;
        type: string;
        lanHost: string;
        appVersion?: string;
      } = {
        id: poll.peer.deviceId,
        name: poll.peer.deviceName,
        type: 'LAN',
        lanHost: hostOnly,
      };
      if (poll.peer.appVersion) {
        paired.appVersion = poll.peer.appVersion;
      }
      emit('paired', paired);
      pairHint.value = `Paired with ${poll.peer.deviceName}.`;
      pairHintClass.value = 'text-positive';
      emit('update:modelValue', false);
    } else if (poll.status === 'rejected') {
      pairHint.value = 'The PC user declined pairing.';
      pairHintClass.value = 'text-negative';
    } else {
      pairHint.value = 'Timed out or lost connection while waiting for confirmation.';
      pairHintClass.value = 'text-warning';
    }
  } catch (e: unknown) {
    pairHint.value = e instanceof Error ? e.message : String(e);
    pairHintClass.value = 'text-negative';
  } finally {
    pairBusy.value = false;
  }
}

function close() {
  emit('update:modelValue', false);
}
</script>
