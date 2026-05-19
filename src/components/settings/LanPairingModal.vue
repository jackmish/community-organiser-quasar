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
          <div class="text-weight-medium">This PC on your Wi‑Fi (Bonjour / .local):</div>
          <div class="text-caption text-grey-7 q-mb-xs">
            Other devices can search for “CO21” computers — no IP typing needed when discovery
            works.
          </div>
          <div class="text-weight-medium">Or enter an address manually:</div>
          <div v-for="a in serverAddrs" :key="a" class="text-primary">{{ a }}:{{ port }}</div>
        </div>
        <div v-else-if="listenError" class="text-negative q-mt-sm text-caption">{{ listenError }}</div>
      </q-card-section>

      <q-separator v-if="hasElectronLan" />

      <q-card-section>
        <div class="text-subtitle2 q-mb-sm">Discover on Wi‑Fi (Bonjour / .local)</div>
        <q-btn
          outline
          color="primary"
          class="full-width"
          label="Search for CO21 computers"
          :loading="browseBusy"
          :disable="!hasElectronLan"
          @click="browseNetwork"
        />
        <div v-if="!hasElectronLan" class="text-caption text-grey-7 q-mt-xs">
          Automatic discovery runs in the desktop (Electron) app. On phone builds, enter the PC
          address below or scan a QR code when we add one.
        </div>
        <div v-if="browseError" class="text-negative text-caption q-mt-sm">{{ browseError }}</div>
        <q-list v-if="discovered.length" bordered separator class="rounded-borders q-mt-sm">
          <q-item
            v-for="(d, idx) in discovered"
            :key="d.fqdn + idx"
            clickable
            v-ripple
            @click="pickDiscovered(d)"
          >
            <q-item-section>
              <q-item-label>{{ d.displayName }}</q-item-label>
              <q-item-label caption>{{ d.connectHost }}:{{ d.port }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-icon name="chevron_right" color="grey-6" />
            </q-item-section>
          </q-item>
        </q-list>
      </q-card-section>

      <q-separator />

      <q-card-section>
        <div class="text-subtitle2 q-mb-sm">From this device — pair with a PC</div>
        <q-input
          v-model="pcHost"
          dense
          outlined
          label="PC hostname or IP (e.g. Jacks-PC.local or 192.168.1.10)"
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
import type { Co21DiscoveredHost } from 'src/modules/lan/lanPairingDiscovery';
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
    !!(window as unknown as { electronLan?: { startServer?: unknown; browseCo21?: unknown } })
      .electronLan?.startServer,
);

const listenOn = ref(false);
const serverAddrs = ref<string[]>([]);
const listenError = ref('');

const pcHost = ref('');
const pairBusy = ref(false);
const pairHint = ref('');
const pairHintClass = ref('text-grey-7');

const browseBusy = ref(false);
const browseError = ref('');
const discovered = ref<Co21DiscoveredHost[]>([]);

watch(
  () => props.modelValue,
  async (open) => {
    if (!open) {
      if (listenOn.value && hasElectronLan.value) {
        await stopListen();
      }
      pcHost.value = '';
      pairHint.value = '';
      discovered.value = [];
      browseError.value = '';
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

function pickDiscovered(d: Co21DiscoveredHost) {
  pcHost.value = d.connectHost;
  pairHint.value = `Selected “${d.displayName}”. Tap “Request pairing” below.`;
  pairHintClass.value = 'text-grey-7';
}

async function browseNetwork() {
  browseError.value = '';
  discovered.value = [];
  browseBusy.value = true;
  try {
    const elan = (window as unknown as {
      electronLan?: { browseCo21?: (o: Record<string, unknown>) => Promise<unknown> };
    }).electronLan;
    if (!elan?.browseCo21) {
      browseError.value = 'Discovery is not available in this build.';
      return;
    }
    const myId = await deviceId.get();
    const res = (await elan.browseCo21({
      timeoutMs: 5000,
      excludeDeviceId: myId,
    })) as { ok?: boolean; devices?: Co21DiscoveredHost[]; error?: string };
    if (!res?.ok) {
      browseError.value = res?.error || 'Search failed.';
      return;
    }
    discovered.value = Array.isArray(res.devices) ? res.devices : [];
    if (!discovered.value.length) {
      browseError.value =
        'No CO21 computers found. Check that the PC has “Accept pairing” on and the same Wi‑Fi.';
    }
  } catch (e: unknown) {
    browseError.value = e instanceof Error ? e.message : String(e);
  } finally {
    browseBusy.value = false;
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
