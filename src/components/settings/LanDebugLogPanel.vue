<template>
  <div class="lan-debug-log debug-tools-surface" :class="{ 'lan-debug-log--mobile': mobile }">
    <div
      class="lan-debug-log__toolbar"
      :class="mobile ? 'column items-stretch q-gutter-y-sm' : 'row items-center q-gutter-sm'"
    >
      <div class="text-subtitle2" :class="{ 'text-center': mobile }">LAN connection log</div>
      <q-space v-if="!mobile" />
      <div
        :class="
          mobile ? 'column items-stretch q-gutter-y-xs' : 'row items-center q-gutter-xs no-wrap'
        "
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
          icon="delete_sweep"
          label="Clear"
          class="lan-debug-log__clear-btn"
          @click="clearLanDebugLog"
        />
      </div>
    </div>

    <div class="text-caption q-mb-xs lan-debug-log__status">
      {{ buildInfo }}
    </div>

    <div v-if="!entries.length" class="text-caption text-grey q-mt-sm">
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
      <q-expansion-item
        v-for="entry in entries"
        :key="entry.id"
        :dense="!mobile"
        :header-class="headerClass(entry)"
        :default-opened="entry.kind === 'http' && !entry.ok && entry.ok !== undefined"
      >
        <template #header>
          <q-item-section class="lan-debug-log__header-main">
            <q-item-label class="text-weight-medium lan-debug-log__title">
              {{ entry.title }}
            </q-item-label>
            <q-item-label caption class="lan-debug-log__meta">
              <span>{{ formatTime(entry.at) }}</span>
              <span v-if="entry.durationMs != null"> · {{ entry.durationMs }}ms</span>
            </q-item-label>
            <q-item-label v-if="entry.url" caption class="lan-debug-log__url">
              {{ entry.url }}
            </q-item-label>
          </q-item-section>
          <q-item-section side top class="lan-debug-log__badge-side column items-end q-gutter-xs">
            <q-badge v-if="entry.errorCode" :color="statusColor(entry)" outline>
              {{ entry.errorCode }}
            </q-badge>
            <q-badge v-if="entry.status != null && entry.finished !== false" :color="statusColor(entry)">
              {{ entry.status }}
            </q-badge>
            <q-spinner v-else-if="entry.kind === 'http' && entry.finished === false" size="16px" />
            <q-icon v-else-if="entry.error" name="error" color="negative" size="sm" />
          </q-item-section>
        </template>

        <q-card
          flat
          bordered
          :class="mobile ? 'q-ma-xs q-pa-sm' : 'q-ma-sm q-pa-sm'"
          class="lan-debug-log__body"
        >
          <template v-if="entry.kind === 'http'">
            <div class="lan-debug-block q-mb-sm">
              <div class="lan-debug-block__title">Request sent</div>
              <div v-if="entry.transport" class="text-caption q-mb-xs">
                Transport: <code>{{ entry.transport }}</code>
              </div>
              <div class="text-caption text-grey">Method & URL</div>
              <pre class="lan-debug-pre">{{ formatRequestLine(entry) }}</pre>
              <div
                v-if="entry.requestHeaders && Object.keys(entry.requestHeaders).length"
                class="q-mt-sm"
              >
                <div class="text-caption text-grey">Headers</div>
                <pre class="lan-debug-pre">{{ formatHeaders(entry.requestHeaders) }}</pre>
              </div>
              <div class="q-mt-sm">
                <div class="text-caption text-grey">Payload</div>
                <pre class="lan-debug-pre">{{ formatRequestPayload(entry) }}</pre>
              </div>
            </div>

            <div class="lan-debug-block">
              <div class="lan-debug-block__title">Response</div>
              <div class="text-caption text-grey">Status code</div>
              <pre class="lan-debug-pre">{{ formatStatusLine(entry) }}</pre>
              <div v-if="entry.error" class="q-mt-sm text-negative">
                <div class="text-caption">Error message</div>
                <pre class="lan-debug-pre lan-debug-pre--error">{{ entry.error }}</pre>
              </div>
              <div class="q-mt-sm">
                <div class="text-caption text-grey">Body</div>
                <pre class="lan-debug-pre">{{ formatResponseBody(entry) }}</pre>
              </div>
            </div>

            <div v-if="entry.detail" class="text-caption text-grey q-mt-sm">
              {{ entry.detail }}
            </div>
          </template>
          <template v-else>
            <div v-if="entry.detail" class="q-mb-sm">
              <pre class="lan-debug-pre">{{ entry.detail }}</pre>
            </div>
            <div v-if="entry.url" class="text-caption lan-debug-log__url">
              <code>{{ entry.url }}</code>
            </div>
          </template>
        </q-card>
      </q-expansion-item>
    </q-list>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import {
  lanDebugEntries,
  clearLanDebugLog,
  formatLanDebugJson,
  getLanDebugBuildInfo,
  lanDebugPlatformHint,
  type LanDebugEntry,
} from 'src/modules/lan/lanDebugLog';

defineProps<{ mobile?: boolean }>();

const entries = lanDebugEntries;
const platformHint = lanDebugPlatformHint();
const buildInfo = computed(() => getLanDebugBuildInfo());

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

.lan-debug-log__toolbar {
  width: 100%;
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
</style>
