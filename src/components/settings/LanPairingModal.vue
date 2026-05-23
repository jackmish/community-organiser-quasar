<template>
  <q-dialog :model-value="modelValue" v-bind="dialogBind" @update:model-value="emit('update:modelValue', $event)">
    <q-card :class="[cardClass, 'lan-pairing-dialog-card']" :style="cardStyle">
      <q-card-section :class="headerClass">
        <div class="text-h6">{{ $text('lan.pairing_title') }}</div>
        <div v-if="showHostPanel" class="text-caption lan-pairing-caption q-mt-xs">
          Other devices connect on port {{ port }}. When pairing completes, both devices are
          added to each other’s Connections list.
        </div>
      </q-card-section>

      <q-card-section :class="[bodyClass, 'q-pt-none q-px-md q-pb-md']" :style="bodyStyle">
        <LanPairingPanel
          :active="modelValue"
          :own-device-name="ownDeviceName"
          v-bind="pendingOffer ? { pendingOffer } : {}"
          @paired="onPaired"
          @request-close="close"
        />
      </q-card-section>

      <q-card-actions align="right" class="q-pt-none">
        <q-btn flat label="Close" color="primary" @click="close" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { $text } from 'src/modules/lang';
import { CO21_LAN_PAIRING_PORT } from 'src/modules/lan/lanPairingConstants';
import { hasCo21LanServer } from 'src/modules/lan/co21LanRuntime';
import type { LanPendingDetail, LanPairedDevicePayload } from 'src/modules/lan/lanPairingUi';
import { useSettingsDialogLayout } from 'src/composables/useSettingsDialogLayout';
import LanPairingPanel from './LanPairingPanel.vue';

const { dialogBind, cardClass, cardStyle, headerClass, bodyClass, bodyStyle } =
  useSettingsDialogLayout(720, 900);

defineProps<{
  modelValue: boolean;
  ownDeviceName: string;
  pendingOffer?: LanPendingDetail | null;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
  (e: 'paired', payload: LanPairedDevicePayload): void;
}>();

const port = CO21_LAN_PAIRING_PORT;
const showHostPanel = computed(
  () => typeof window !== 'undefined' && hasCo21LanServer(),
);

function onPaired(payload: LanPairedDevicePayload): void {
  emit('paired', payload);
}

function close(): void {
  emit('update:modelValue', false);
}
</script>
