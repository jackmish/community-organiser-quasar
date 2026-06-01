<template>
  <q-dialog v-model="dialogVisible" v-bind="dialogBind">
    <q-card :class="cardClass" :style="cardStyle">
      <q-card-section :class="headerClass">
        <div class="text-h6">{{ $text('infoscreen.title') }}</div>
      </q-card-section>

      <q-card-section class="q-pt-sm" :class="bodyClass" :style="bodyStyle">
        <div class="q-gutter-md">
          <q-toggle
            v-model="enabled"
            :label="$text('infoscreen.enabled')"
            dense
            :disable="saving"
            @update:model-value="onEnabledChange"
          />

          <q-separator />

          <q-select
            v-model="selectedVariant"
            :options="variantOptions"
            :label="$text('infoscreen.variant_label')"
            emit-value
            map-options
            dense
            outlined
            :disable="saving"
            @update:model-value="onVariantChange"
          />

          <div class="text-caption text-grey-7">
            {{ variantHint }}
          </div>

          <template v-if="selectedVariant === 'wall-clock'">
            <q-separator />

            <q-toggle
              v-model="lockScreen"
              :label="$text('infoscreen.lock_screen')"
              dense
              :disable="saving"
              @update:model-value="onLockChange"
            />

            <div class="text-caption text-grey-7 q-mt-none">
              {{ $text('infoscreen.lock_screen_hint') }}
            </div>

            <q-select
              v-model="clockPreset"
              :options="clockPresetOptions"
              :label="$text('infoscreen.clock_interval_label')"
              emit-value
              map-options
              dense
              outlined
              :disable="saving"
              @update:model-value="onClockPresetChange"
            />

            <q-input
              v-if="clockPreset === 'custom'"
              v-model.number="clockCustomMinutes"
              type="number"
              dense
              outlined
              :label="$text('infoscreen.clock_interval_custom')"
              :min="1"
              :max="1440"
              :disable="saving"
              @blur="onClockCustomBlur"
            />

            <q-input
              v-model.number="clockDisplaySeconds"
              type="number"
              dense
              outlined
              :label="$text('infoscreen.clock_display_seconds')"
              :min="minClockDisplaySeconds"
              :max="maxClockDisplaySeconds"
              :disable="saving"
              @blur="onClockDisplaySecondsBlur"
            />

            <div class="text-caption text-grey-7 q-mt-none">
              {{ $text('infoscreen.clock_display_seconds_hint') }}
            </div>

            <q-btn
              unelevated
              color="primary"
              icon="schedule"
              :label="$text('infoscreen.test_clock_now')"
              :disable="saving || testingClock"
              :loading="testingClock"
              class="full-width"
              @click="onTestClockNow"
            />
          </template>
        </div>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat :label="$text('action.close')" color="primary" @click="close" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { $text } from 'src/modules/lang';
import { useSettingsDialogLayout } from 'src/composables/useSettingsDialogLayout';
import {
  INFOSCREEN_CLOCK_INTERVAL_PRESETS,
  INFOSCREEN_VARIANTS,
  loadInfoscreenSettings,
  saveInfoscreenSettings,
  dispatchInfoscreenTestClock,
  MIN_CLOCK_DISPLAY_SECONDS,
  MAX_CLOCK_DISPLAY_SECONDS,
  type InfoscreenClockIntervalPreset,
  type InfoscreenVariantId,
} from '../index';

const { dialogBind, cardClass, cardStyle, headerClass, bodyClass, bodyStyle } =
  useSettingsDialogLayout(420, 560);

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>();

const dialogVisible = computed({
  get: () => !!props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
});

const enabled = ref(false);
const selectedVariant = ref<InfoscreenVariantId>('wall-clock');
const lockScreen = ref(false);
const clockPreset = ref<InfoscreenClockIntervalPreset>('15');
const clockCustomMinutes = ref(15);
const clockDisplaySeconds = ref(10);
const saving = ref(false);
const testingClock = ref(false);

const minClockDisplaySeconds = MIN_CLOCK_DISPLAY_SECONDS;
const maxClockDisplaySeconds = MAX_CLOCK_DISPLAY_SECONDS;

const variantOptions = computed(() =>
  INFOSCREEN_VARIANTS.map((variant) => ({
    label: $text(variant.labelKey),
    value: variant.id,
  })),
);

const clockPresetOptions = computed(() =>
  INFOSCREEN_CLOCK_INTERVAL_PRESETS.map((id) => ({
    label:
      id === 'custom'
        ? $text('infoscreen.clock_interval.custom')
        : $text('infoscreen.clock_interval.minutes').replace('{n}', id),
    value: id,
  })),
);

const variantHint = computed(() => {
  if (selectedVariant.value === 'wall-clock') {
    return $text('infoscreen.variant_hint_wall_clock');
  }
  return $text('infoscreen.variant_hint_layout_drift');
});

async function loadIntoForm(): Promise<void> {
  const s = await loadInfoscreenSettings();
  enabled.value = s.enabled;
  selectedVariant.value = s.variant;
  lockScreen.value = s.lockScreen;
  clockPreset.value = s.clockIntervalPreset;
  clockCustomMinutes.value = s.clockIntervalCustomMinutes;
  clockDisplaySeconds.value = s.clockDisplaySeconds;
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) void loadIntoForm();
  },
);

async function persist(patch: Parameters<typeof saveInfoscreenSettings>[0]): Promise<void> {
  saving.value = true;
  try {
    const ok = await saveInfoscreenSettings(patch);
    if (!ok) await loadIntoForm();
  } finally {
    saving.value = false;
  }
}

async function onEnabledChange(value: boolean): Promise<void> {
  await persist({ enabled: value });
}

async function onVariantChange(value: InfoscreenVariantId): Promise<void> {
  await persist({ variant: value });
}

async function onLockChange(value: boolean): Promise<void> {
  await persist({ lockScreen: value });
}

async function onClockPresetChange(value: InfoscreenClockIntervalPreset): Promise<void> {
  await persist({
    clockIntervalPreset: value,
    clockIntervalCustomMinutes: clockCustomMinutes.value,
  });
}

async function onClockCustomBlur(): Promise<void> {
  if (clockPreset.value !== 'custom') return;
  await persist({
    clockIntervalPreset: 'custom',
    clockIntervalCustomMinutes: clockCustomMinutes.value,
  });
}

async function onClockDisplaySecondsBlur(): Promise<void> {
  await persist({ clockDisplaySeconds: clockDisplaySeconds.value });
}

async function onTestClockNow(): Promise<void> {
  testingClock.value = true;
  try {
    await persist({
      variant: 'wall-clock',
      clockDisplaySeconds: clockDisplaySeconds.value,
      clockIntervalPreset: clockPreset.value,
      clockIntervalCustomMinutes: clockCustomMinutes.value,
    });
    selectedVariant.value = 'wall-clock';
    dispatchInfoscreenTestClock();
    close();
  } finally {
    testingClock.value = false;
  }
}

function close(): void {
  dialogVisible.value = false;
}
</script>
