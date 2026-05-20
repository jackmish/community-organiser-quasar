<template>
  <q-dialog :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)">
    <q-card style="min-width: 360px; max-width: 92vw">
      <q-card-section>
        <div class="text-h6">Wi‑Fi / LAN pairing</div>
        <div class="text-caption text-grey-7 q-mt-xs">
          <template v-if="hasElectronLan">
            Other devices connect on port {{ port }}. Share the QR or an address below.
          </template>
          <template v-else>
            Phone and PC must be on the same Wi‑Fi. Enter the PC’s IP only — you do not need to
            type :{{ port }} (the app adds it).
          </template>
        </div>
      </q-card-section>

      <q-card-section v-if="!hasElectronLan" class="q-pt-none">
        <div class="text-subtitle2 q-mb-xs">This phone on Wi‑Fi</div>
        <div v-if="deviceLanProbeBusy" class="text-caption text-grey-7">Detecting address…</div>
        <div v-else-if="deviceLanAddrs.length" class="text-body2">
          <div v-for="a in deviceLanAddrs" :key="a" class="text-primary">{{ a }}</div>
          <div class="text-caption text-grey-7 q-mt-xs">
            The PC’s address should look similar (e.g. both <strong>192.168.1.x</strong>). Turn off
            mobile data if pairing fails.
          </div>
        </div>
        <div v-else class="text-caption text-grey-7">
          Could not detect a Wi‑Fi address. Connect to Wi‑Fi (not mobile data) and reopen this
          dialog.
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
          <div class="text-weight-medium">For another PC — copy address with port:</div>
          <div v-for="a in serverAddrs" :key="a" class="row items-center no-wrap q-gutter-xs">
            <span class="text-primary">{{ a }}:{{ port }}</span>
            <q-btn
              flat
              dense
              round
              size="sm"
              icon="content_copy"
              color="grey-7"
              :aria-label="`Copy ${a}:${port}`"
              @click="copyText(`${a}:${port}`)"
            />
          </div>

          <q-separator class="q-my-md" />
          <div class="text-subtitle2 q-mb-sm">Share this PC (QR)</div>
          <div class="text-caption text-grey-7 q-mb-sm">
            Phone must use <strong>Wi‑Fi on the same network</strong> as this PC (not mobile data).
            On your phone: CO21 → Connections → Wi‑Fi / LAN → <strong>Scan PC QR with camera</strong>,
            then <strong>Request pairing</strong>.
          </div>
          <q-select
            v-if="serverAddrs.length > 1"
            v-model="qrHost"
            dense
            outlined
            :options="serverAddrs"
            label="Address encoded in QR"
            class="q-mb-sm"
          />
          <div
            v-if="qrDataUrl"
            class="flex flex-center q-pa-sm bg-white rounded-borders"
            style="max-width: 280px"
          >
            <q-img
              :src="qrDataUrl"
              fit="contain"
              style="width: 220px; height: 220px"
              spinner-color="primary"
              alt="LAN pairing QR code"
            />
          </div>
          <div v-else-if="listenOn && qrHost" class="text-caption text-grey-6 q-py-md">Generating QR…</div>
          <div v-if="qrPayloadPreview" class="text-caption text-grey-7 q-mt-xs break-all">
            {{ qrPayloadPreview }}
          </div>
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
          Automatic discovery runs in the desktop (Electron) app. On other builds, use the QR from
          the PC or type the address below.
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
          label="PC IP or hostname (no port needed)"
          hint="Scan the PC’s QR or type e.g. 192.168.1.10 — port :47321 is added automatically"
          persistent-hint
          class="q-mb-sm"
        />
        <div v-if="pcConnectPreview" class="text-caption text-grey-7 q-mb-sm">
          Will connect to:
          <span class="text-primary break-all">{{ pcConnectPreview }}</span>
        </div>
        <q-btn
          v-if="showQrCameraButton"
          outline
          color="positive"
          icon="photo_camera"
          label="Scan PC QR with camera"
          class="full-width q-mb-sm"
          :loading="qrCameraBusy"
          @click="scanQrWithCamera"
        />
        <q-btn
          outline
          color="secondary"
          icon="qr_code_scanner"
          label="Load address from QR image"
          class="full-width q-mb-sm"
          @click="triggerQrFilePick"
        />
        <input
          ref="qrFileInput"
          type="file"
          accept="image/*"
          class="lan-qr-file-input"
          @change="onQrFileChange"
        />
        <q-btn
          v-if="!pairActive"
          color="primary"
          unelevated
          label="Request pairing"
          :disable="!pcHost.trim()"
          @click="requestPairToPc"
        />
        <q-btn
          v-else
          color="warning"
          unelevated
          label="Cancel pairing"
          @click="cancelPairing"
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
import jsQR from 'jsqr';
import { deviceId } from 'src/modules/storage/sync/deviceId';
import { CO21_LAN_PAIRING_PORT, co21LanBaseUrl } from 'src/modules/lan/lanPairingConstants';
import { buildLanPairingQrPayload, parseHostFromLanQrContent } from 'src/modules/lan/lanQrPayload';
import {
  lanConnectionTroubleshootHint,
  probeLocalLanIPv4Addresses,
} from 'src/modules/lan/lanNetwork';
import { canUseLanQrCamera, scanLanQrWithCamera } from 'src/modules/lan/lanQrScan';
import {
  lanFetchInfoWithRetry,
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

const showQrCameraButton = canUseLanQrCamera();

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
const pairActive = ref(false);
const pairAbort = ref<AbortController | null>(null);
const pairHint = ref('');
const pairHintClass = ref('text-grey-7');

const LAN_CONNECT_ATTEMPTS = 5;
const LAN_CONNECT_RETRY_DELAY_MS = 5000;
const LAN_CONNECT_TIMEOUT_MS = 5000;

const browseBusy = ref(false);
const browseError = ref('');
const discovered = ref<Co21DiscoveredHost[]>([]);

const qrHost = ref('');
const qrDataUrl = ref('');
const qrFileInput = ref<HTMLInputElement | null>(null);
const qrCameraBusy = ref(false);

const qrPayloadPreview = computed(() => {
  if (!listenOn.value || !qrHost.value) return '';
  try {
    return buildLanPairingQrPayload(qrHost.value);
  } catch {
    return '';
  }
});

const pcConnectPreview = computed(() => {
  const h = pcHost.value.trim();
  if (!h) return '';
  return co21LanBaseUrl(h) || '';
});

const deviceLanAddrs = ref<string[]>([]);
const deviceLanProbeBusy = ref(false);

watch(serverAddrs, (addrs) => {
  if (!addrs.length) {
    qrHost.value = '';
    return;
  }
  if (!addrs.includes(qrHost.value)) {
    qrHost.value = addrs[0] ?? '';
  }
});

async function regenerateQr(): Promise<void> {
  qrDataUrl.value = '';
  if (!listenOn.value || !qrHost.value) return;
  try {
    const QR = (await import('qrcode')).default;
    const payload = buildLanPairingQrPayload(qrHost.value);
    qrDataUrl.value = await QR.toDataURL(payload, {
      width: 240,
      margin: 2,
      errorCorrectionLevel: 'M',
    });
  } catch (e) {
    logger.warn('[LanPairingModal] QR generation failed', e);
  }
}

watch([listenOn, qrHost], () => {
  void regenerateQr();
});

watch(
  () => props.modelValue,
  async (open) => {
    if (!open) {
      cancelPairing();
      if (listenOn.value && hasElectronLan.value) {
        await stopListen();
      }
      pcHost.value = '';
      pairHint.value = '';
      discovered.value = [];
      browseError.value = '';
      qrDataUrl.value = '';
      deviceLanAddrs.value = [];
      return;
    }
    if (hasElectronLan.value) {
      void refreshStatus();
    } else {
      void refreshDeviceLanAddresses();
    }
  },
);

async function refreshDeviceLanAddresses(): Promise<void> {
  deviceLanProbeBusy.value = true;
  deviceLanAddrs.value = [];
  try {
    deviceLanAddrs.value = await probeLocalLanIPv4Addresses();
  } catch (e) {
    logger.warn('[LanPairingModal] device LAN probe failed', e);
  } finally {
    deviceLanProbeBusy.value = false;
  }
}

async function copyText(text: string): Promise<void> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      pairHint.value = 'Copied to clipboard.';
      pairHintClass.value = 'text-grey-7';
    }
  } catch (e) {
    logger.warn('[LanPairingModal] copy failed', e);
  }
}

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
  pcHost.value =
    d.port && d.port !== port ? `${d.connectHost}:${d.port}` : d.connectHost;
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
  if (pairActive.value) return;

  pairHint.value = 'Connecting…';
  pairHintClass.value = 'text-grey-7';
  pairActive.value = true;
  const controller = new AbortController();
  pairAbort.value = controller;
  const { signal } = controller;

  try {
    const base = co21LanBaseUrl(pcHost.value.trim());
    if (!base) {
      pairHint.value = 'Invalid PC address. Use an IP like 192.168.1.10 or scan the QR again.';
      pairHintClass.value = 'text-negative';
      return;
    }

    let info: Awaited<ReturnType<typeof lanFetchInfoWithRetry>> = null;
    try {
      info = await lanFetchInfoWithRetry(base, {
        attempts: LAN_CONNECT_ATTEMPTS,
        delayMs: LAN_CONNECT_RETRY_DELAY_MS,
        timeoutMs: LAN_CONNECT_TIMEOUT_MS,
        signal,
        onAttemptFailed: (attempt) => {
          if (signal.aborted) return;
          if (attempt === 1) {
            pairHint.value = 'Connection problems.';
            pairHintClass.value = 'text-warning';
          } else if (attempt < LAN_CONNECT_ATTEMPTS) {
            pairHint.value = `Connection problems. Retrying (${attempt}/${LAN_CONNECT_ATTEMPTS})…`;
            pairHintClass.value = 'text-warning';
          }
        },
      });
    } catch (e: unknown) {
      if (signal.aborted) return;
      const detail = e instanceof Error ? e.message : String(e);
      pairHint.value = `${detail}. ${lanConnectionTroubleshootHint(port)}`;
      pairHintClass.value = 'text-negative';
      return;
    }

    if (signal.aborted) return;

    if (!info) {
      pairHint.value =
        `Could not connect after ${LAN_CONNECT_ATTEMPTS} attempts. ` +
        lanConnectionTroubleshootHint(port);
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

    const req = await lanPostPairRequest(
      base,
      {
        deviceId: myId,
        deviceName: myName,
        appVersion: myVer,
      },
      { timeoutMs: LAN_CONNECT_TIMEOUT_MS, signal },
    );
    if (signal.aborted) return;

    if (!req) {
      pairHint.value = 'Pairing request was rejected or the PC is not accepting LAN pairing.';
      pairHintClass.value = 'text-negative';
      return;
    }

    pairHint.value = 'Waiting for someone on the PC to confirm…';
    pairHintClass.value = 'text-grey-7';
    const poll = await lanPollUntilResolved(base, req.token, { signal });
    if (signal.aborted) return;

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
    if (signal.aborted) return;
    pairHint.value = e instanceof Error ? e.message : String(e);
    pairHintClass.value = 'text-negative';
  } finally {
    pairActive.value = false;
    pairAbort.value = null;
  }
}

function cancelPairing(): void {
  pairAbort.value?.abort();
  pairAbort.value = null;
  pairActive.value = false;
  pairHint.value = 'Pairing cancelled.';
  pairHintClass.value = 'text-grey-7';
}

function applyQrText(text: string): boolean {
  const host = parseHostFromLanQrContent(text);
  if (!host) {
    pairHint.value = 'The QR code did not contain a valid PC address or link.';
    pairHintClass.value = 'text-negative';
    return false;
  }
  pcHost.value = host;
  const preview = co21LanBaseUrl(host);
  pairHint.value = preview
    ? `Address loaded from QR. Will use ${preview} — tap “Request pairing”.`
    : 'Address loaded from QR. Tap “Request pairing”.';
  pairHintClass.value = 'text-grey-7';
  return true;
}

async function scanQrWithCamera(): Promise<void> {
  qrCameraBusy.value = true;
  pairHint.value = '';
  try {
    const text = await scanLanQrWithCamera();
    if (!text) {
      pairHint.value = 'Scan cancelled.';
      pairHintClass.value = 'text-grey-7';
      return;
    }
    applyQrText(text);
  } catch (e: unknown) {
    pairHint.value = e instanceof Error ? e.message : String(e);
    pairHintClass.value = 'text-negative';
  } finally {
    qrCameraBusy.value = false;
  }
}

async function decodeQrFromImageFile(file: File): Promise<string | null> {
  let bmp: ImageBitmap | null = null;
  try {
    bmp = await createImageBitmap(file);
    const max = 960;
    let w = bmp.width;
    let h = bmp.height;
    if (w > max || h > max) {
      const r = Math.min(max / w, max / h);
      w = Math.floor(w * r);
      h = Math.floor(h * r);
    }
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(bmp, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);
    const code = jsQR(imageData.data, w, h, { inversionAttempts: 'attemptBoth' });
    return code?.data ?? null;
  } finally {
    if (bmp && typeof bmp.close === 'function') {
      bmp.close();
    }
  }
}

function triggerQrFilePick(): void {
  const el = qrFileInput.value;
  if (el) {
    el.value = '';
    el.click();
  }
}

async function onQrFileChange(ev: Event): Promise<void> {
  const input = ev.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  try {
    const text = await decodeQrFromImageFile(file);
    if (!text) {
      pairHint.value = 'No QR code found in that image.';
      pairHintClass.value = 'text-warning';
      return;
    }
    applyQrText(text);
  } catch (e: unknown) {
    pairHint.value = e instanceof Error ? e.message : String(e);
    pairHintClass.value = 'text-negative';
  }
}

function close() {
  emit('update:modelValue', false);
}
</script>

<style scoped>
.lan-qr-file-input {
  display: none;
}
</style>
