<template>
  <q-dialog v-model="show" v-bind="dialogBind">
    <q-card :class="['debug-tools-dialog', cardClass]" :style="cardStyle">
      <q-card-section
        class="row items-center q-pb-none debug-tools-dialog__header"
        :class="headerClass"
      >
        <div class="text-h6">Debug tools</div>
        <q-space />
        <q-btn flat round dense icon="close" aria-label="Close" @click="close" />
      </q-card-section>

      <q-card-section
        :class="[bodyClass, 'debug-tools-dialog__body', 'q-pt-sm']"
        :style="bodyStyle"
      >
        <LanDebugLogPanel :mobile="isMobile" @retry-contract="onRetryContract" />

        <q-separator class="q-my-md debug-tools-dialog__sep" />

        <div class="debug-tools-dialog__repair">
          <div class="text-subtitle2 q-mb-sm">Data repair</div>
          <q-btn
            outline
            color="warning"
            icon="healing"
            label="Fix invalid dates"
            class="debug-tools-dialog__repair-btn"
            :loading="fixing"
            @click="runFixDates"
          />
          <div v-if="fixResult !== null" class="q-mt-sm text-caption">
            <span v-if="fixResult === 0" class="text-positive">No invalid dates found.</span>
            <span v-else class="text-warning">Fixed {{ fixResult }} date value(s). Data saved.</span>
          </div>
        </div>

        <q-separator class="q-my-md debug-tools-dialog__sep" />

        <div class="debug-tools-dialog__repair">
          <div class="text-subtitle2 q-mb-sm">{{ $text('debug.media_thumbs.title') }}</div>
          <q-btn
            outline
            color="primary"
            icon="photo_size_select_large"
            :label="$text('debug.media_thumbs.clear')"
            class="debug-tools-dialog__repair-btn"
            :loading="clearingThumbs"
            @click="runClearThumbCache"
          />
          <div v-if="clearThumbResult !== null" class="q-mt-sm text-caption text-positive">
            {{ clearThumbResultMessage }}
          </div>
        </div>
      </q-card-section>

      <q-card-actions align="right" class="debug-tools-dialog__footer col-auto">
        <q-btn flat label="Close" class="debug-tools-dialog__close-btn" @click="close" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import CC from 'src/CCAccess';
import { fixInvalidDatesInDays } from 'src/utils/dateUtils';
import { saveData } from 'src/utils/storageUtils';
import LanDebugLogPanel from './LanDebugLogPanel.vue';
import { setLanDebugForceCapture, type LanDebugEntry } from 'src/modules/lan/lanDebugLog';
import { clearMediaThumbnailCache } from 'src/modules/media/mediaFolderService';
import { $text } from 'src/modules/lang';
import { useSettingsDialogLayout } from 'src/composables/useSettingsDialogLayout';
import { Notify } from 'quasar';
import { watch } from 'vue';

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ (e: 'update:modelValue', value: boolean): void }>();

const { dialogBind, cardClass, cardStyle, headerClass, bodyClass, bodyStyle, isMobile } =
  useSettingsDialogLayout(720, 800);

watch(
  () => props.modelValue,
  (open) => {
    if (open) setLanDebugForceCapture(true);
  },
  { immediate: true },
);

const show = computed({
  get() {
    return props.modelValue;
  },
  set(v: boolean) {
    emit('update:modelValue', v);
  },
});

const fixing = ref(false);
const fixResult = ref<number | null>(null);
const clearingThumbs = ref(false);
const clearThumbResult = ref<number | null>(null);

const clearThumbResultMessage = computed(() => {
  if (clearThumbResult.value === null) return '';
  return $text('debug.media_thumbs.cleared').replace('{count}', String(clearThumbResult.value));
});

async function runFixDates() {
  fixing.value = true;
  fixResult.value = null;
  try {
    const daysRef: any = CC.task.time.days;
    const days = daysRef.value ?? daysRef;
    const count = fixInvalidDatesInDays(days);
    if (count > 0) {
      await saveData();
    }
    fixResult.value = count;
  } catch {
    fixResult.value = 0;
  } finally {
    fixing.value = false;
  }
}

async function runClearThumbCache() {
  clearingThumbs.value = true;
  clearThumbResult.value = null;
  try {
    const result = await clearMediaThumbnailCache();
    if (!result.ok) {
      Notify.create({
        type: 'negative',
        message: result.error || $text('debug.media_thumbs.failed'),
        timeout: 3000,
      });
      return;
    }
    clearThumbResult.value = result.fileCount;
    Notify.create({
      type: 'positive',
      message: $text('debug.media_thumbs.cleared').replace('{count}', String(result.fileCount)),
      timeout: 3000,
    });
  } catch {
    Notify.create({
      type: 'negative',
      message: $text('debug.media_thumbs.failed'),
      timeout: 3000,
    });
  } finally {
    clearingThumbs.value = false;
  }
}

async function onRetryContract(entry: LanDebugEntry) {
  const url = entry.url;
  if (!url) return;
  try {
    const { lanHttpRequest } = await import('src/modules/lan/lanHttp');
    const body = entry.requestBody ?? '';
    await lanHttpRequest({
      url,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      timeoutMs: 15000,
    });
    Notify.create({ type: 'positive', message: 'Retry sent', timeout: 2000 });
  } catch {
    Notify.create({ type: 'negative', message: 'Retry failed', timeout: 2000 });
  }
}

function close() {
  show.value = false;
}
</script>

<style scoped lang="scss">
.debug-tools-dialog {
  background: #fff !important;
  color: #212121;
}

.debug-tools-dialog__header,
.debug-tools-dialog__body,
.debug-tools-dialog__footer {
  background: #fff;
  color: #212121;
}

.debug-tools-dialog__sep {
  background: #e0e0e0;
}

.debug-tools-dialog__repair-btn {
  max-width: 100%;
}

.debug-tools-dialog.settings-dialog-card--mobile .debug-tools-dialog__footer {
  padding-bottom: max(12px, env(safe-area-inset-bottom, 0px));
}

.debug-tools-dialog.settings-dialog-card--mobile .debug-tools-dialog__close-btn {
  width: 100%;
  min-height: 44px;
}
</style>
