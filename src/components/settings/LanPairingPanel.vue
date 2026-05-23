<template>
  <div
    :class="[
      'lan-pairing-panel',
      'lan-pairing-dialog-body',
      { 'lan-pairing-panel--client': !showHostPanel },
      { 'lan-pairing-panel--embedded': embedded },
      embedded ? '' : bodyClass,
    ]"
    :style="embedded ? undefined : bodyStyle"
  >
        <div v-if="incomingPending && showHostPanel" class="lan-pairing-incoming-wrap q-mb-md">
          <q-banner dense rounded class="lan-incoming-banner text-white">
            <template #avatar>
              <q-icon name="wifi" color="white" />
            </template>
            <div class="text-weight-medium">Incoming pairing request</div>
            <div class="text-body2 q-mt-xs">
              <strong>{{ incomingPending.remoteName }}</strong> wants to connect with this device.
            </div>
            <div v-if="incomingPending.remoteAddress" class="text-caption q-mt-xs">
              From {{ incomingPending.remoteAddress }}
            </div>
            <div class="text-caption q-mt-sm">
              Accept to link both devices — each will appear in the other’s Connections list.
            </div>
            <template #action>
              <q-btn flat dense label="Decline" color="white" @click="declineIncoming" />
              <q-btn unelevated dense label="Accept" color="white" text-color="positive" :loading="incomingBusy"
                @click="acceptIncoming" />
            </template>
          </q-banner>
        </div>

        <div :class="lanLayoutClass">
          <!-- Connect to PC (phone/tablet) or PC host tools (desktop) -->
          <section class="lan-pairing-col lan-pairing-col--pc">
            <div
              v-if="showHostPanel"
              class="text-subtitle1 text-weight-medium lan-pairing-col__title q-mb-sm"
            >
              {{ $text('lan.col_pc') }}
            </div>

            <template v-if="showHostPanel">
              <q-toggle :model-value="listenOn" :label="$text('lan.accept_pairing')" color="positive"
                @update:model-value="onToggleListen" />

              <div class="text-subtitle2 q-mb-xs">Bonjour / .local</div>
              <div class="text-caption lan-pairing-muted q-mb-sm">
                {{ $text('lan.bonjour_hint') }}
              </div>
            </template>

            <template v-if="!showHostPanel">
              <div class="lan-pairing-pair-block q-mb-md">
                <div class="text-subtitle2 lan-pairing-pair-label q-mb-xs">
                  {{ $text('lan.pc_host_label') }}
                </div>
                <div
                  class="row q-col-gutter-sm lan-pairing-pair-row"
                  :class="{ column: isMobileViewport }"
                >
                  <q-input
                    v-model="pcHost"
                    dense
                    outlined
                    hide-bottom-space
                    class="col-12 connections-device-sync-input lan-pairing-pair-input"
                    :placeholder="$text('lan.pc_host_label')"
                    @keyup.enter="requestPairToPc"
                  />
                  <q-btn
                    v-if="!pairActive"
                    unelevated
                    color="primary"
                    class="col-12 lan-pairing-pair-btn full-width"
                    :label="$text('lan.request_pairing')"
                    :disable="!pcHost.trim()"
                    @click="requestPairToPc"
                  />
                  <q-btn
                    v-else
                    unelevated
                    color="warning"
                    class="col-12 lan-pairing-pair-btn full-width"
                    :label="$text('lan.cancel_pairing')"
                    @click="cancelPairing"
                  />
                </div>
                <div v-if="pcConnectPreview" class="text-caption lan-pairing-muted q-mt-xs">
                  <span class="lan-pairing-emphasis break-all">{{ pcConnectPreview }}</span>
                </div>
                <div v-if="pairHint" class="text-caption q-mt-sm" :class="pairHintClass">{{ pairHint }}</div>
              </div>
            </template>

            <div
              class="lan-pairing-tool-row q-mb-sm"
              :class="{ 'lan-pairing-tool-row--stacked': isMobileViewport || !showHostPanel }"
            >
              <q-btn
                v-if="showHostPanel"
                outline
                color="primary"
                icon="search"
                class="settings-dialog-surface-btn lan-pairing-tool-btn"
                :label="$text('lan.search_co21')"
                :loading="browseBusy"
                @click="browseNetwork"
              />
              <q-btn
                outline
                color="secondary"
                icon="qr_code_scanner"
                class="settings-dialog-surface-btn lan-pairing-tool-btn"
                :label="$text('lan.load_qr_image')"
                @click="triggerQrFilePick"
              />
              <q-btn
                v-if="showQrCameraButton"
                outline
                color="positive"
                icon="photo_camera"
                class="settings-dialog-surface-btn lan-pairing-tool-btn"
                :label="$text('lan.scan_qr_camera')"
                :loading="qrCameraBusy"
                @click="scanQrWithCamera"
              />
            </div>
            <input ref="qrFileInput" type="file" accept="image/*" class="lan-qr-file-input" @change="onQrFileChange" />

            <template v-if="showHostPanel">
              <div v-if="browseError" class="text-negative text-caption q-mb-sm">{{ browseError }}</div>
              <q-list
                v-if="discovered.length"
                bordered
                separator
                class="rounded-borders lan-pairing-discovered-list q-mb-md"
              >
                <q-item v-for="(d, idx) in discovered" :key="d.fqdn + idx">
                  <q-item-section>
                    <q-item-label class="lan-pairing-list-label">{{ d.displayName }}</q-item-label>
                    <q-item-label caption>{{ d.connectHost }}:{{ d.port }}</q-item-label>
                  </q-item-section>
                  <q-item-section side class="lan-pairing-discovered-pair-side">
                    <q-btn
                      unelevated
                      dense
                      color="primary"
                      size="sm"
                      class="lan-pairing-discovered-pair-btn"
                      :label="$text('lan.pair_device')"
                      :disable="pairActive"
                      :loading="pairActive && pairingTargetKey === discoveredPairKey(d, idx)"
                      @click="pairWithDiscovered(d, idx)"
                    />
                  </q-item-section>
                </q-item>
              </q-list>
            </template>

            <template v-if="showHostPanel">
              <q-separator class="lan-pairing-pair-separator q-my-md" />

              <div class="lan-pairing-pair-block">
                <div class="text-caption lan-pairing-pair-label q-mb-xs">
                  {{ $text('lan.pc_host_label') }}
                </div>
                <div
                  class="row q-col-gutter-sm items-center lan-pairing-pair-row"
                  :class="{ column: isMobileViewport }"
                >
                  <q-input
                    v-model="pcHost"
                    dense
                    outlined
                    hide-bottom-space
                    class="col connections-device-sync-input lan-pairing-pair-input"
                    style="min-width: 0"
                    :placeholder="$text('lan.pc_host_label')"
                    @keyup.enter="requestPairToPc"
                  />
                  <q-btn
                    v-if="!pairActive"
                    unelevated
                    color="primary"
                    class="col-auto lan-pairing-pair-btn"
                    :class="{ 'full-width': isMobileViewport }"
                    :label="$text('lan.request_pairing')"
                    :disable="!pcHost.trim()"
                    @click="requestPairToPc"
                  />
                  <q-btn
                    v-else
                    unelevated
                    color="warning"
                    class="col-auto lan-pairing-pair-btn"
                    :class="{ 'full-width': isMobileViewport }"
                    :label="$text('lan.cancel_pairing')"
                    @click="cancelPairing"
                  />
                </div>
                <div class="text-caption lan-pairing-muted q-mt-xs">
                  {{ $text('lan.pc_host_hint') }}
                </div>
              </div>
              <div v-if="pcConnectPreview" class="text-caption lan-pairing-muted q-mt-xs">
                Will connect to:
                <span class="lan-pairing-emphasis break-all">{{ pcConnectPreview }}</span>
              </div>
              <div v-if="pairHint" class="text-caption q-mt-sm" :class="pairHintClass">{{ pairHint }}</div>
            </template>
          </section>

          <!-- QR + addresses for phones/tablets (desktop host only) -->
          <section v-if="showHostPanel" class="lan-pairing-col lan-pairing-col--mobile">
            <q-separator class="lan-pairing-mobile-divider q-mb-md" />
            <div class="text-subtitle1 text-weight-medium lan-pairing-col__title q-mb-sm">
              {{ $text('lan.col_mobile') }}
            </div>

            <template v-if="listenOn">
              <div class="text-caption lan-pairing-muted q-mb-sm">
                {{ $text('lan.qr_share_hint') }}
              </div>
              <q-select v-if="serverAddrs.length > 1" v-model="qrHost" dense outlined :options="serverAddrs"
                label="Address in QR"
                class="connections-device-sync-input q-mb-sm"
              />
              <div v-if="qrDataUrl" class="flex flex-center q-pa-sm bg-white rounded-borders lan-qr-wrap q-mb-sm">
                <q-img :src="qrDataUrl" fit="contain" class="lan-qr-img" spinner-color="primary"
                  alt="LAN pairing QR code" />
              </div>
              <div v-else-if="qrHost" class="text-caption lan-pairing-muted q-py-md text-center">
                Generating QR…
              </div>

              <div class="text-subtitle2 q-mb-xs">{{ $text('lan.this_pc_addresses') }}</div>
              <div v-if="serverAddrs.length" class="lan-pairing-address-panel q-pa-sm rounded-borders">
                <div v-for="a in serverAddrs" :key="a" class="row items-center no-wrap q-gutter-xs q-mb-xs">
                  <span class="lan-pairing-emphasis">{{ a }}:{{ port }}</span>
                  <q-btn flat dense round size="sm" icon="content_copy" class="settings-dialog-surface-btn"
                    :aria-label="`Copy ${a}:${port}`" @click="copyText(`${a}:${port}`)" />
                </div>
              </div>
              <div v-else class="text-caption lan-pairing-muted">
                No LAN address detected yet.
              </div>
              <div v-if="qrPayloadPreview" class="text-caption lan-pairing-muted q-mt-xs break-all">
                {{ qrPayloadPreview }}
              </div>
            </template>
            <div v-else class="text-body2 lan-pairing-muted">
              {{ $text('lan.enable_pairing_for_qr') }}
            </div>
            <div v-if="listenError" class="text-negative q-mt-sm text-caption">{{ listenError }}</div>
          </section>
        </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { $text } from 'src/modules/lang';
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
  lanNotifyProposerAccepted,
  lanPostPairRequest,
} from 'src/modules/lan/lanPairingClient';
import {
  cancelOutboundPairingPoll,
  runOutboundPairingPoll,
} from 'src/modules/lan/lanPairingOutbound';
import type { Co21DiscoveredHost } from 'src/modules/lan/lanPairingDiscovery';
import {
  LAN_PAIRING_PENDING_EVENT,
  buildLanPairedPayloadFromPending,
  clearLanPendingOffer,
  dispatchLanPaired,
  parseLanPendingDetail,
  peekLanPendingOffer,
  type LanPendingDetail,
  type LanPairedDevicePayload,
} from 'src/modules/lan/lanPairingUi';
import { isUsableLanHost, parseLanReachableAddresses } from 'src/modules/lan/lanPairingHosts';
import { persistPairedLanDevice } from 'src/modules/lan/lanPairingRegister';
import { saveLanAutoListen } from 'src/modules/lan/lanServerManager';
import { hasCo21LanServer } from 'src/modules/lan/co21LanRuntime';
import logger from 'src/utils/logger';
import { useSettingsDialogLayout } from 'src/composables/useSettingsDialogLayout';

const { bodyClass, bodyStyle, isMobile: isMobileViewport } = useSettingsDialogLayout(720);

const props = withDefaults(
  defineProps<{
    ownDeviceName: string;
    /** Set by parent when IPC arrives before this panel mounted. */
    pendingOffer?: LanPendingDetail | null;
    /** When false, pairing UI resets (tab hidden / dialog closed). */
    active?: boolean;
    /** Inside AddConnectionDialog tabs — no nested scroll/flex column chrome. */
    embedded?: boolean;
  }>(),
  { active: true, embedded: false },
);

const emit = defineEmits<{
  (e: 'paired', payload: LanPairedDevicePayload): void;
  (e: 'request-close'): void;
}>();

const port = CO21_LAN_PAIRING_PORT;

const showQrCameraButton = canUseLanQrCamera();

const hasElectronLan = computed(
  () => typeof window !== 'undefined' && hasCo21LanServer(),
);

/** Desktop Electron: host QR/Bonjour + accept incoming. Phone/tablet: connect-to-PC only. */
const showHostPanel = computed(() => hasElectronLan.value);

const lanLayoutClass = computed(() => {
  if (!showHostPanel.value || isMobileViewport.value || props.embedded) {
    return 'lan-pairing-layout lan-pairing-layout--single';
  }
  return 'lan-pairing-layout lan-pairing-layout--split';
});

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

const incomingPending = ref<LanPendingDetail | null>(null);
const incomingBusy = ref(false);

function applyPendingOffer(detail: LanPendingDetail | null | undefined): void {
  if (!detail) return;
  incomingPending.value = detail;
}

function onPairingPendingDetail(raw: Record<string, unknown>): void {
  const detail = parseLanPendingDetail(raw);
  applyPendingOffer(detail);
}

async function resolveMyLanReachableAddresses(): Promise<string[]> {
  const out: string[] = [];
  const push = (a: string) => {
    if (isUsableLanHost(a) && !out.includes(a)) out.push(a);
  };
  for (const a of deviceLanAddrs.value) push(a);
  for (const a of serverAddrs.value) push(a);
  try {
    const elan = (window as unknown as {
      electronLan?: { status?: () => Promise<{ addresses?: string[] }> };
    }).electronLan;
    const st = await elan?.status?.();
    for (const a of st?.addresses ?? []) push(String(a));
  } catch {
    void 0;
  }
  return out;
}

function onPairingPendingWindow(ev: Event): void {
  const ce = ev as CustomEvent<Record<string, unknown>>;
  if (ce.detail) onPairingPendingDetail(ce.detail);
}

async function completePairing(payload: LanPairedDevicePayload): Promise<void> {
  await persistPairedLanDevice(payload);
  dispatchLanPaired(payload);
  emit('paired', payload);
  pairHint.value = `Connected with ${payload.name}. Both devices are now linked.`;
  pairHintClass.value = 'text-positive';
}

async function acceptIncoming(): Promise<void> {
  const p = incomingPending.value;
  if (!p || incomingBusy.value) return;
  incomingBusy.value = true;
  try {
    const elan = (window as unknown as {
      electronLan?: { resolvePair?: (t: string, a: boolean) => Promise<unknown> };
    }).electronLan;
    if (!elan?.resolvePair) {
      pairHint.value = 'Accept is only available in the desktop app.';
      pairHintClass.value = 'text-negative';
      return;
    }
    const res = (await elan.resolvePair(p.token, true)) as { ok?: boolean };
    if (!res?.ok) {
      pairHint.value = 'This request expired or was already answered.';
      pairHintClass.value = 'text-warning';
      incomingPending.value = null;
      return;
    }
    const localPayload = buildLanPairedPayloadFromPending(p);
    const { rememberPeerLanHostCandidates } = await import('src/modules/lan/lanRemoteHost');
    const hostCandidates = [
      ...(localPayload.lanHostCandidates ?? []),
      localPayload.lanHost,
      ...parseLanReachableAddresses([
        ...(p.remoteLanAddresses ?? []),
        p.remoteAddress,
      ]),
    ];
    if (hostCandidates.length) {
      await rememberPeerLanHostCandidates(localPayload.id, hostCandidates);
    }
    void notifyProposerWeAccepted(p);
    await completePairing(localPayload);
    incomingPending.value = null;
    clearLanPendingOffer();
  } catch (e: unknown) {
    pairHint.value = e instanceof Error ? e.message : String(e);
    pairHintClass.value = 'text-negative';
  } finally {
    incomingBusy.value = false;
  }
}

/** Push acceptor identity to initiator so it registers us even if its poll stopped. */
async function ensureLanListeningForPairing(): Promise<void> {
  if (!hasElectronLan.value) return;
  const elan = (window as unknown as {
    electronLan?: {
      status?: () => Promise<{ listening?: boolean }>;
      startServer?: (i: {
        deviceId: string;
        deviceName: string;
        appVersion: string;
      }) => Promise<unknown>;
    };
  }).electronLan;
  if (!elan?.startServer) return;
  try {
    const st = await elan.status?.();
    if (st?.listening) return;
    const id = await deviceId.get();
    const name = (props.ownDeviceName || '').trim() || 'This device';
    const ver =
      typeof (window as unknown as { APP_VERSION?: string }).APP_VERSION === 'string'
        ? String((window as unknown as { APP_VERSION?: string }).APP_VERSION)
        : '';
    await elan.startServer({ deviceId: id, deviceName: name, appVersion: ver });
    await refreshStatus();
  } catch (e) {
    logger.warn('[LanPairingModal] ensure LAN listen failed', e);
  }
}

/** Push acceptor identity to initiator so it registers us even if its poll stopped. */
async function notifyProposerWeAccepted(p: LanPendingDetail): Promise<void> {
  await ensureLanListeningForPairing();
  const proposerHosts = parseLanReachableAddresses([
    ...(p.remoteLanAddresses ?? []),
    p.remoteAddress,
  ]);
  if (!proposerHosts.length) return;
  try {
    const myId = await deviceId.get();
    const myName = (props.ownDeviceName || '').trim() || 'This device';
    const myVer =
      typeof (window as unknown as { APP_VERSION?: string }).APP_VERSION === 'string'
        ? String((window as unknown as { APP_VERSION?: string }).APP_VERSION)
        : '';
    const myLanAddrs = await resolveMyLanReachableAddresses();
    void lanNotifyProposerAccepted(
      proposerHosts,
      {
        deviceId: myId,
        deviceName: myName,
        appVersion: myVer,
        ...(myLanAddrs.length ? { lanReachableAddresses: myLanAddrs } : {}),
      },
      { attempts: 25, retryDelayMs: 2000, timeoutMs: 10_000 },
    ).then((ok) => {
      if (!ok) {
        logger.warn('[LanPairingModal] could not notify proposer to register this device');
      }
    });
  } catch (e) {
    logger.warn('[LanPairingModal] notify proposer failed', e);
  }
}

async function declineIncoming(): Promise<void> {
  const p = incomingPending.value;
  if (!p) return;
  try {
    const elan = (window as unknown as {
      electronLan?: { resolvePair?: (t: string, a: boolean) => Promise<unknown> };
    }).electronLan;
    await elan?.resolvePair?.(p.token, false);
  } catch (e) {
    logger.warn('[LanPairingModal] decline failed', e);
  }
  incomingPending.value = null;
  pairHint.value = 'Pairing request declined.';
  pairHintClass.value = 'text-grey-7';
}

onMounted(() => {
  window.addEventListener(LAN_PAIRING_PENDING_EVENT, onPairingPendingWindow as EventListener);
  const stashed = peekLanPendingOffer();
  if (stashed) applyPendingOffer(stashed);
});

onBeforeUnmount(() => {
  window.removeEventListener(LAN_PAIRING_PENDING_EVENT, onPairingPendingWindow as EventListener);
});

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
  () => props.pendingOffer,
  (p) => {
    applyPendingOffer(p ?? null);
  },
  { immediate: true },
);

watch(
  () => props.active,
  async (open) => {
    if (open) {
      const stashed = peekLanPendingOffer();
      if (stashed && !incomingPending.value) applyPendingOffer(stashed);
    }
    if (!open) {
      if (!pairActive.value) {
        cancelPairing();
      }
      pcHost.value = '';
      if (!incomingPending.value) {
        pairHint.value = '';
      }
      discovered.value = [];
      browseError.value = '';
      qrDataUrl.value = '';
      deviceLanAddrs.value = [];
      return;
    }
    if (hasElectronLan.value) {
      void refreshStatus().then(() => maybeStartBonjourDiscovery());
    } else {
      void refreshDeviceLanAddresses();
    }
  },
  { immediate: true },
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
  await saveLanAutoListen(v);
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
      maybeStartBonjourDiscovery();
    } else {
      listenOn.value = false;
      listenError.value = res?.error || 'Could not start LAN server';
    }
  } catch (e: unknown) {
    listenOn.value = false;
    listenError.value = e instanceof Error ? e.message : String(e);
  }
}

function discoveredPairKey(d: Co21DiscoveredHost, idx: number): string {
  return `${d.fqdn}#${idx}`;
}

function hostFromDiscovered(d: Co21DiscoveredHost): string {
  return d.port && d.port !== port ? `${d.connectHost}:${d.port}` : d.connectHost;
}

const pairingTargetKey = ref<string | null>(null);

async function pairWithDiscovered(d: Co21DiscoveredHost, idx: number): Promise<void> {
  if (pairActive.value) return;
  const key = discoveredPairKey(d, idx);
  pairingTargetKey.value = key;
  pcHost.value = hostFromDiscovered(d);
  try {
    await requestPairToPc();
  } finally {
    if (pairingTargetKey.value === key) {
      pairingTargetKey.value = null;
    }
  }
}

function maybeStartBonjourDiscovery(): void {
  if (!hasElectronLan.value || !listenOn.value || browseBusy.value) return;
  void browseNetwork();
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

function remoteHostHintFromPcHost(): string {
  const trimmed = pcHost.value.trim();
  const noScheme = trimmed.replace(/^https?:\/\//i, '');
  const hostPart = noScheme.split('/')[0] ?? '';
  return (hostPart.split(':')[0] ?? '').trim();
}

async function requestPairToPc() {
  if (pairActive.value) return;
  await ensureLanListeningForPairing();
  if (hasElectronLan.value) {
    await refreshStatus();
  } else {
    await refreshDeviceLanAddresses();
  }

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

    const myLanAddrs = await resolveMyLanReachableAddresses();
    const req = await lanPostPairRequest(
      base,
      {
        deviceId: myId,
        deviceName: myName,
        appVersion: myVer,
        ...(myLanAddrs.length ? { lanReachableAddresses: myLanAddrs } : {}),
      },
      { timeoutMs: LAN_CONNECT_TIMEOUT_MS, signal },
    );
    if (signal.aborted) return;

    if (!req) {
      pairHint.value = 'Pairing request was rejected or the PC is not accepting LAN pairing.';
      pairHintClass.value = 'text-negative';
      return;
    }

    pairHint.value =
      'Waiting for confirmation on the other device — open Wi‑Fi / LAN there and tap Accept. ' +
      'You can close this dialog; pairing will continue up to 5 minutes.';
    pairHintClass.value = 'text-grey-7';

    const hostHint = remoteHostHintFromPcHost() || 'unknown';
    const accepted = await runOutboundPairingPoll(
      { baseUrl: base, token: req.token, remoteHostHint: hostHint },
      {
        onAccepted: (name) => {
          pairHint.value = `Connected with ${name}. Both devices are now linked.`;
          pairHintClass.value = 'text-positive';
        },
        onRejected: () => {
          pairHint.value = 'The other device declined pairing.';
          pairHintClass.value = 'text-negative';
        },
        onTimeout: () => {
          pairHint.value =
            'Still waiting or lost connection. If you already accepted on the other device, ' +
            'check Connections — or try pairing again.';
          pairHintClass.value = 'text-warning';
        },
      },
    );
    if (accepted) {
      emit('request-close');
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
  cancelOutboundPairingPoll();
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

</script>

<style scoped>
.lan-qr-file-input {
  display: none;
}

.lan-incoming-banner {
  background: #2e7d32;
}
</style>
