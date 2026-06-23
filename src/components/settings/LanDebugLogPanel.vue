<template>
  <q-expansion-item
    expand-separator
    header-class="lan-debug-log__section-header text-weight-medium"
    class="lan-debug-log debug-tools-surface"
    :class="{ 'lan-debug-log--mobile': mobile }"
  >
    <template #header>
      <q-item-section avatar>
        <q-icon name="router" />
      </q-item-section>
      <q-item-section class="lan-debug-log__header-main">
        <q-item-label class="text-subtitle2">LAN connection log</q-item-label>
        <q-item-label caption class="lan-debug-log__section-caption">
          {{ sectionCaption }}
        </q-item-label>
      </q-item-section>
      <q-item-section side class="lan-debug-log__header-actions">
        <div
          class="row items-center q-gutter-xs no-wrap"
          @click.stop
        >
          <q-chip
            dense
            :size="mobile ? 'md' : 'sm'"
            color="grey-8"
            text-color="white"
            class="lan-debug-log__platform-chip"
          >
            {{ platformHint }}
          </q-chip>
          <q-btn
            flat
            :dense="!mobile"
            icon="troubleshoot"
            label="Diagnose"
            class="lan-debug-log__clear-btn"
            :loading="diagnosing"
            @click="onDiagnose"
          />
          <q-btn
            flat
            :dense="!mobile"
            icon="delete_sweep"
            label="Clear"
            class="lan-debug-log__clear-btn"
            @click="clearLanDebugLog"
          />
        </div>
      </q-item-section>
    </template>

    <div class="lan-debug-log__inner q-pt-xs">
      <div class="text-caption q-mb-xs lan-debug-log__status">
        {{ buildInfo }}
      </div>

      <div v-if="!displayItems.length" class="text-caption text-grey q-mt-sm">
        No LAN requests yet. Pair, Check a device, or sync — HTTP calls appear here.
        If capture shows <strong>off</strong>, rebuild with <code>npm run android</code>.
      </div>

      <q-list
        v-else
        bordered
        separator
        class="lan-debug-log__list rounded-borders q-mt-sm"
        :class="{ 'lan-debug-log__list--mobile': mobile }"
      >
      <template v-for="item in displayItems" :key="item.type === 'single' ? item.entry.id : item.key">
        <!-- Grouped exchange entries -->
        <q-expansion-item
          v-if="item.type === 'group'"
          :dense="!mobile"
          :header-class="groupHeaderClass(item)"
        >
          <template #header>
            <q-item-section class="lan-debug-log__header-main">
              <q-item-label class="text-weight-medium lan-debug-log__title">
                {{ item.label }}
              </q-item-label>
              <q-item-label caption class="lan-debug-log__meta">
                <span>{{ formatTime(item.entries[0]!.at) }} — {{ formatTime(item.entries[item.entries.length - 1]!.at) }}</span>
              </q-item-label>
            </q-item-section>
            <q-item-section side top class="lan-debug-log__badge-side column items-end q-gutter-xs">
              <q-badge :color="item.lastOk ? 'positive' : item.lastOk === false ? 'negative' : 'grey'">
                {{ item.entries.length }}
              </q-badge>
            </q-item-section>
          </template>

          <q-list dense separator class="lan-debug-log__group-inner">
            <q-expansion-item
              v-for="entry in item.entries"
              :key="entry.id"
              dense
              :header-class="headerClass(entry)"
            >
              <template #header>
                <q-item-section class="lan-debug-log__header-main">
                  <q-item-label class="text-weight-medium lan-debug-log__title" style="font-size: 12px">
                    {{ entry.title }}
                  </q-item-label>
                  <q-item-label caption class="lan-debug-log__meta">
                    <span>{{ formatTime(entry.at) }}</span>
                    <span v-if="entry.durationMs != null"> · {{ entry.durationMs }}ms</span>
                  </q-item-label>
                </q-item-section>
                <q-item-section side top class="lan-debug-log__badge-side">
                  <q-badge v-if="entry.status != null && entry.finished !== false" :color="statusColor(entry)" dense>
                    {{ entry.status }}
                  </q-badge>
                  <q-spinner v-else-if="entry.finished === false" size="14px" />
                </q-item-section>
              </template>
              <q-card flat bordered class="q-ma-xs q-pa-sm lan-debug-log__body">
                <div class="lan-debug-block q-mb-sm">
                  <div class="lan-debug-block__title">Request</div>
                  <pre class="lan-debug-pre">{{ formatRequestLine(entry) }}</pre>
                </div>
                <div class="lan-debug-block">
                  <div class="lan-debug-block__title">Response</div>
                  <pre class="lan-debug-pre">{{ formatStatusLine(entry) }}</pre>
                  <div v-if="entry.error" class="q-mt-xs text-negative">
                    <pre class="lan-debug-pre lan-debug-pre--error">{{ entry.error }}</pre>
                  </div>
                  <div class="q-mt-xs">
                    <pre class="lan-debug-pre">{{ formatResponseBody(entry) }}</pre>
                  </div>
                </div>
              </q-card>
            </q-expansion-item>
          </q-list>
        </q-expansion-item>

        <!-- Single entry (non-exchange or isolated exchange) -->
        <q-expansion-item
          v-else
          :dense="!mobile"
          :header-class="headerClass(item.entry)"
          :default-opened="item.entry.kind === 'http' && !item.entry.ok && item.entry.ok !== undefined"
        >
          <template #header>
            <q-item-section class="lan-debug-log__header-main">
              <q-item-label class="text-weight-medium lan-debug-log__title">
                {{ item.entry.title }}
              </q-item-label>
              <q-item-label caption class="lan-debug-log__meta">
                <span>{{ formatTime(item.entry.at) }}</span>
                <span v-if="item.entry.durationMs != null"> · {{ item.entry.durationMs }}ms</span>
              </q-item-label>
              <q-item-label v-if="item.entry.url" caption class="lan-debug-log__url">
                {{ item.entry.url }}
              </q-item-label>
            </q-item-section>
            <q-item-section side top class="lan-debug-log__badge-side column items-end q-gutter-xs">
              <q-btn
                v-if="isContractEntry(item.entry) && item.entry.ok === false && item.entry.finished !== false"
                dense
                flat
                size="sm"
                icon="refresh"
                color="negative"
                label="Retry"
                class="lan-debug-log__retry-btn"
                @click.stop="emit('retry-contract', item.entry)"
              />
              <q-badge v-if="item.entry.errorCode" :color="statusColor(item.entry)" outline>
                {{ item.entry.errorCode }}
              </q-badge>
              <q-badge v-if="item.entry.status != null && item.entry.finished !== false" :color="statusColor(item.entry)">
                {{ item.entry.status }}
              </q-badge>
              <q-spinner v-else-if="item.entry.kind === 'http' && item.entry.finished === false" size="16px" />
              <q-icon v-else-if="item.entry.error" name="error" color="negative" size="sm" />
            </q-item-section>
          </template>

          <q-card
            flat
            bordered
            :class="mobile ? 'q-ma-xs q-pa-sm' : 'q-ma-sm q-pa-sm'"
            class="lan-debug-log__body"
          >
            <template v-if="item.entry.kind === 'http'">
              <div class="lan-debug-block q-mb-sm">
                <div class="lan-debug-block__title">Request sent</div>
                <div v-if="item.entry.transport" class="text-caption q-mb-xs">
                  Transport: <code>{{ item.entry.transport }}</code>
                </div>
                <div class="text-caption text-grey">Method & URL</div>
                <pre class="lan-debug-pre">{{ formatRequestLine(item.entry) }}</pre>
                <div
                  v-if="item.entry.requestHeaders && Object.keys(item.entry.requestHeaders).length"
                  class="q-mt-sm"
                >
                  <div class="text-caption text-grey">Headers</div>
                  <pre class="lan-debug-pre">{{ formatHeaders(item.entry.requestHeaders) }}</pre>
                </div>
                <div class="q-mt-sm">
                  <div class="text-caption text-grey">Payload</div>
                  <pre class="lan-debug-pre">{{ formatRequestPayload(item.entry) }}</pre>
                </div>
              </div>

              <div class="lan-debug-block">
                <div class="lan-debug-block__title">Response</div>
                <div class="text-caption text-grey">Status code</div>
                <pre class="lan-debug-pre">{{ formatStatusLine(item.entry) }}</pre>
                <div v-if="item.entry.error" class="q-mt-sm text-negative">
                  <div class="text-caption">Error message</div>
                  <pre class="lan-debug-pre lan-debug-pre--error">{{ item.entry.error }}</pre>
                </div>
                <div class="q-mt-sm">
                  <div class="text-caption text-grey">Body</div>
                  <pre class="lan-debug-pre">{{ formatResponseBody(item.entry) }}</pre>
                </div>
              </div>

              <div v-if="item.entry.detail" class="text-caption text-grey q-mt-sm">
                {{ item.entry.detail }}
              </div>
            </template>
            <template v-else>
              <div v-if="item.entry.detail" class="q-mb-sm">
                <pre class="lan-debug-pre">{{ item.entry.detail }}</pre>
              </div>
              <div v-if="item.entry.url" class="text-caption lan-debug-log__url">
                <code>{{ item.entry.url }}</code>
              </div>
            </template>
          </q-card>
        </q-expansion-item>
      </template>
    </q-list>
    </div>
  </q-expansion-item>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  lanDebugEntries,
  clearLanDebugLog,
  formatLanDebugJson,
  getLanDebugBuildInfo,
  lanDebugPlatformHint,
  type LanDebugEntry,
} from 'src/modules/lan/lanDebugLog';
import { runLanNetworkDiagnose } from 'src/modules/lan/lanDiagnostics';

defineProps<{ mobile?: boolean }>();

type DisplayItem =
  | { type: 'single'; entry: LanDebugEntry }
  | { type: 'group'; key: string; label: string; entries: LanDebugEntry[]; lastOk: boolean | undefined; lastStatus: number | undefined };

function isExchangeEntry(e: LanDebugEntry): boolean {
  return e.kind === 'http' && !!(e.url?.includes('/sync/exchange'));
}

function isContractEntry(e: LanDebugEntry): boolean {
  if (e.kind !== 'http') return false;
  const url = e.url ?? '';
  return url.includes('/sync/contract/propose')
    || url.includes('/sync/contract/accept')
    || url.includes('/sync/contract/reject');
}

const emit = defineEmits<{
  (e: 'retry-contract', entry: LanDebugEntry): void;
}>();

const displayItems = computed<DisplayItem[]>(() => {
  const raw = lanDebugEntries.value;
  const contractItems: DisplayItem[] = [];
  const exchangeEntries: LanDebugEntry[] = [];
  const otherItems: DisplayItem[] = [];

  for (const e of raw) {
    if (isContractEntry(e)) {
      contractItems.push({ type: 'single', entry: e });
    } else if (isExchangeEntry(e)) {
      exchangeEntries.push(e);
    } else {
      otherItems.push({ type: 'single', entry: e });
    }
  }

  const result: DisplayItem[] = [...contractItems];

  if (exchangeEntries.length > 0) {
    const okCount = exchangeEntries.filter((g) => g.ok === true).length;
    const failCount = exchangeEntries.filter((g) => g.ok === false).length;
    const pending = exchangeEntries.filter((g) => g.finished === false).length;
    const parts: string[] = [];
    if (okCount) parts.push(`${okCount} ok`);
    if (failCount) parts.push(`${failCount} failed`);
    if (pending) parts.push(`${pending} pending`);
    result.push({
      type: 'group',
      key: `grp-exchange`,
      label: `${exchangeEntries.length} sync exchange${exchangeEntries.length === 1 ? '' : 's'} (${parts.join(', ') || 'none finished'})`,
      entries: exchangeEntries,
      lastOk: exchangeEntries[0]!.ok,
      lastStatus: exchangeEntries[0]!.status,
    });
  }

  result.push(...otherItems);
  return result;
});

const platformHint = lanDebugPlatformHint();
const buildInfo = computed(() => getLanDebugBuildInfo());
const diagnosing = ref(false);

const sectionCaption = computed(() => {
  const entries = lanDebugEntries.value;
  const count = entries.length;
  const failed = entries.filter((e) => e.ok === false || !!e.error).length;
  const parts: string[] = [];
  if (!count) {
    parts.push('No entries yet');
  } else {
    parts.push(`${count} ${count === 1 ? 'entry' : 'entries'}`);
    if (failed) parts.push(`${failed} failed`);
  }
  return parts.join(' · ');
});

async function onDiagnose(): Promise<void> {
  diagnosing.value = true;
  try {
    await runLanNetworkDiagnose();
  } finally {
    diagnosing.value = false;
  }
}

function formatTime(at: number): string {
  return new Date(at).toLocaleTimeString();
}

function formatBody(raw: string): string {
  return formatLanDebugJson(raw);
}

function formatHeaders(h: Record<string, string>): string {
  return Object.entries(h)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');
}

function formatRequestLine(entry: LanDebugEntry): string {
  const method = entry.method || 'GET';
  const url = entry.url || '—';
  return `${method} ${url}`;
}

function formatRequestPayload(entry: LanDebugEntry): string {
  if (entry.requestBody !== undefined && entry.requestBody !== '') {
    return formatBody(entry.requestBody);
  }
  const method = (entry.method || 'GET').toUpperCase();
  if (method === 'GET' || method === 'OPTIONS') {
    return '(no body — ' + method + ')';
  }
  return '(empty body)';
}

function formatStatusLine(entry: LanDebugEntry): string {
  if (entry.finished === false) return '… in progress';
  const code = entry.status != null ? entry.status : '—';
  const label = entry.ok ? 'OK' : entry.error ? 'failed' : 'not OK';
  const extra = entry.errorCode ? ` · ${entry.errorCode}` : '';
  return `${code} ${label}${extra}`;
}

function formatResponseBody(entry: LanDebugEntry): string {
  if (entry.finished === false) return '… waiting for response';
  if (!entry.responseBody) return '(no response recorded)';
  if (
    entry.responseBody === '(empty)' ||
    entry.responseBody === '(no response body)' ||
    entry.responseBody === '(empty body)'
  ) {
    return entry.responseBody;
  }
  return formatBody(entry.responseBody);
}

function statusColor(entry: LanDebugEntry): string {
  if (entry.errorCode === 'NETWORK' || entry.errorCode === 'TIMEOUT') return 'negative';
  if (entry.status == null) return 'grey';
  if (entry.status >= 200 && entry.status < 300) return 'positive';
  if (entry.status >= 400 || entry.status === 0) return 'negative';
  return 'warning';
}

function headerClass(entry: LanDebugEntry): string {
  if (entry.kind === 'event') return 'lan-debug-log__header';
  if (entry.error || entry.ok === false) return 'lan-debug-log__header bg-red-1';
  if (entry.ok === true) return 'lan-debug-log__header bg-green-1';
  return 'lan-debug-log__header bg-blue-1';
}

function groupHeaderClass(item: DisplayItem & { type: 'group' }): string {
  if (item.lastOk === true) return 'lan-debug-log__header bg-green-1';
  if (item.lastOk === false) return 'lan-debug-log__header bg-red-1';
  return 'lan-debug-log__header bg-blue-1';
}
</script>

<style scoped lang="scss">
.debug-tools-surface {
  background: #fff;
  color: #212121;
}

.lan-debug-log__status {
  color: #616161;
  word-break: break-word;
}

.lan-debug-log__section-caption {
  word-break: break-word;
  white-space: normal;
  line-height: 1.35;
}

.lan-debug-log__header-actions {
  flex-shrink: 0;
  padding-left: 4px;
}

.lan-debug-log--mobile .lan-debug-log__header-actions .row {
  flex-wrap: wrap;
  justify-content: flex-end;
}

.lan-debug-log__inner {
  padding: 0 4px 4px;
}

.lan-debug-log__platform-chip {
  max-width: 100%;
  height: auto;

  :deep(.q-chip__content) {
    white-space: normal;
    line-height: 1.25;
  }
}

.lan-debug-log__clear-btn {
  align-self: stretch;
}

.lan-debug-log--mobile .lan-debug-log__clear-btn {
  min-height: 40px;
}

.lan-debug-log__list {
  max-height: min(55vh, 480px);
  overflow: auto;
  background: #fff;
  -webkit-overflow-scrolling: touch;
}

.lan-debug-log__list--mobile {
  max-height: none;
  overflow: visible;
}

.lan-debug-log__list :deep(.q-item) {
  background: #fff;
  color: #212121;
}

.lan-debug-log__list--mobile :deep(.q-expansion-item__container) {
  border-radius: 4px;
}

.lan-debug-log__list--mobile :deep(.q-item) {
  min-height: 48px;
  padding-top: 8px;
  padding-bottom: 8px;
}

.lan-debug-log__header-main {
  min-width: 0;
  flex: 1 1 auto;
}

.lan-debug-log__title {
  word-break: break-word;
  line-height: 1.3;
}

.lan-debug-log__meta,
.lan-debug-log__url {
  word-break: break-all;
  white-space: normal;
  line-height: 1.35;
}

.lan-debug-log__url {
  font-size: 11px;
  opacity: 0.85;
}

.lan-debug-log__badge-side {
  flex-shrink: 0;
  padding-left: 4px;
}

.lan-debug-log__body {
  background: #fafafa !important;
}

.lan-debug-block__title {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #424242;
  margin-bottom: 6px;
}

.lan-debug-block + .lan-debug-block {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #e0e0e0;
}

.lan-debug-pre--error {
  border-color: #e57373;
  background: #ffebee;
}

.lan-debug-pre {
  margin: 4px 0 0;
  padding: 8px;
  font-size: 11px;
  line-height: 1.35;
  white-space: pre-wrap;
  word-break: break-word;
  background: #f0f0f0;
  color: #212121;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  max-height: 200px;
  overflow: auto;
  -webkit-overflow-scrolling: touch;
}

.lan-debug-log--mobile .lan-debug-pre {
  font-size: 12px;
  max-height: min(40vh, 280px);
}

.lan-debug-log__retry-btn {
  font-size: 11px;
  padding: 2px 6px;
}

.lan-debug-log__group-inner {
  background: #f5f5f5;
  padding: 0 4px;
}

.lan-debug-log__group-inner :deep(.q-item) {
  min-height: 32px;
  padding: 2px 8px;
}
</style>
