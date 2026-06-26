<template>
  <div>
    <q-item-label header class="text-weight-bold text-subtitle1">
      {{ $text('accounts.backend_server_section') }}
    </q-item-label>

    <q-banner v-if="!bridgeAvailable" dense rounded class="bg-grey-9 text-white q-mb-sm">
      {{ $text('accounts.backend_server_desktop_only') }}
    </q-banner>

    <q-item tag="label">
      <q-item-section avatar>
        <q-avatar color="deep-orange-8" text-color="white" icon="dns" />
      </q-item-section>
      <q-item-section>
        <q-item-label>{{ $text('accounts.backend_server_title') }}</q-item-label>
        <q-item-label caption>{{ $text('accounts.backend_server_desc') }}</q-item-label>
      </q-item-section>
      <q-item-section side>
        <q-toggle
          v-model="enabled"
          color="deep-orange-8"
          :disable="settingsSaving || !bridgeAvailable"
          @update:model-value="onEnabledToggle"
        />
      </q-item-section>
    </q-item>

    <q-item v-if="enabled && bridgeAvailable">
      <q-item-section>
        <q-input
          v-model="baseUrlDraft"
          dense
          outlined
          :label="$text('accounts.backend_server_base_url')"
          :disable="settingsSaving || busy"
          @blur="saveBaseUrl"
        />
        <q-input
          v-model="backendPathDraft"
          dense
          outlined
          class="q-mt-sm"
          :label="$text('accounts.backend_server_backend_path')"
          :hint="defaultConfig?.backendPath || ''"
          :disable="settingsSaving || busy"
          @blur="saveBackendPath"
        />
        <div class="row items-center q-gutter-sm q-mt-sm">
          <q-badge :color="healthy ? 'positive' : running ? 'warning' : 'grey-7'">
            {{ statusLabel }}
          </q-badge>
          <span v-if="status?.pid" class="text-caption text-grey-6">PID {{ status.pid }}</span>
        </div>
        <div v-if="lastError" class="text-caption text-negative q-mt-xs">{{ lastError }}</div>
      </q-item-section>
      <q-item-section side top>
        <div class="column q-gutter-xs">
          <q-btn
            color="positive"
            outline
            dense
            :label="$text('accounts.backend_server_start')"
            :loading="busy"
            :disable="!enabled || running"
            @click="onStart"
          />
          <q-btn
            color="negative"
            outline
            dense
            :label="$text('accounts.backend_server_stop')"
            :loading="busy"
            :disable="!running"
            @click="onStop"
          />
        </div>
      </q-item-section>
    </q-item>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { $text } from 'src/modules/lang';
import { appNotify } from 'src/utils/appNotify';
import type { Co21ServerDefaultConfig } from 'src/modules/co21-server/co21ServerModel';
import {
  loadCo21ServerBackendPath,
  loadCo21ServerBaseUrl,
  saveCo21ServerBackendPath,
  saveCo21ServerBaseUrl,
  saveCo21ServerEnabled,
} from 'src/modules/co21-server/co21ServerSettings';
import {
  getCo21ServerDefaultConfig,
  isCo21ServerBridgeAvailable,
} from 'src/modules/co21-server/co21ServerService';
import { useCo21Server } from 'src/modules/co21-server/composables/useCo21Server';

const {
  bridgeAvailable,
  enabled,
  running,
  healthy,
  status,
  busy,
  lastError,
  refresh,
  start,
  stop,
} = useCo21Server();

const settingsSaving = ref(false);
const baseUrlDraft = ref('');
const backendPathDraft = ref('');
const defaultConfig = ref<Co21ServerDefaultConfig | null>(null);

const statusLabel = computed(() => {
  if (healthy.value) return $text('accounts.backend_server_status_ready');
  if (running.value) return $text('accounts.backend_server_status_starting');
  return $text('accounts.backend_server_status_stopped');
});

async function loadSettings(): Promise<void> {
  baseUrlDraft.value = await loadCo21ServerBaseUrl();
  backendPathDraft.value = await loadCo21ServerBackendPath();
  if (isCo21ServerBridgeAvailable()) {
    defaultConfig.value = await getCo21ServerDefaultConfig();
    if (!backendPathDraft.value && defaultConfig.value?.backendPath) {
      backendPathDraft.value = defaultConfig.value.backendPath;
    }
  }
  await refresh();
}

watch(
  () => bridgeAvailable.value,
  () => {
    void loadSettings();
  },
  { immediate: true },
);

async function onEnabledToggle(value: boolean): Promise<void> {
  settingsSaving.value = true;
  try {
    await saveCo21ServerEnabled(value);
    if (!value && running.value) await stop();
    await refresh();
  } finally {
    settingsSaving.value = false;
  }
}

async function saveBaseUrl(): Promise<void> {
  settingsSaving.value = true;
  try {
    await saveCo21ServerBaseUrl(baseUrlDraft.value);
    await refresh();
  } finally {
    settingsSaving.value = false;
  }
}

async function saveBackendPath(): Promise<void> {
  settingsSaving.value = true;
  try {
    await saveCo21ServerBackendPath(backendPathDraft.value);
    defaultConfig.value = await getCo21ServerDefaultConfig();
    await refresh();
  } finally {
    settingsSaving.value = false;
  }
}

async function onStart(): Promise<void> {
  const ok = await start();
  if (!ok) {
    appNotify('negative', lastError.value || $text('accounts.backend_server_start_failed'));
  }
}

async function onStop(): Promise<void> {
  await stop();
}
</script>
