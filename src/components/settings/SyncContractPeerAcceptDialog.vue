<template>
  <q-dialog v-model="dialogVisible" persistent v-bind="dialogBind">
    <q-card :class="cardClass" :style="cardStyle">
      <q-card-section class="row items-center q-gutter-sm" :class="headerClass">
        <q-icon name="handshake" color="primary" size="28px" />
        <div class="text-h6">{{ $text('sync.contract_peer_title') }}</div>
      </q-card-section>

      <q-card-section class="q-pt-none">
        <p class="text-body2 q-mb-md">{{ $text('sync.contract_peer_intro') }}</p>
        <q-banner v-if="proposerName" dense rounded class="bg-grey-2">
          {{ $text('sync.contract_peer_waiting') }}
          <strong class="q-ml-xs">{{ proposerName }}</strong>
        </q-banner>
        <p class="text-caption text-grey-7 q-mt-md">
          {{ $text('sync.contract_peer_note') }}
        </p>
        <q-checkbox
          v-if="isIncoming"
          v-model="peerAccepted"
          class="q-mt-md"
          :label="$text('sync.contract_peer_accept_checkbox')"
          color="primary"
        />
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat :label="$text('action.cancel')" @click="onCancel" />
        <q-btn
          v-if="isIncoming"
          unelevated
          color="primary"
          :label="$text('sync.contract_peer_accept')"
          :disable="!peerAccepted"
          @click="onAccept"
        />
        <q-btn
          v-else
          unelevated
          color="primary"
          :label="$text('sync.contract_peer_done')"
          @click="onAccept"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { $text } from 'src/modules/lang';
import { useSettingsDialogLayout } from 'src/composables/useSettingsDialogLayout';

const props = defineProps<{
  modelValue: boolean;
  proposerName?: string;
  /** True when this device must accept another device's proposal. */
  isIncoming?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
  (e: 'accept'): void;
  (e: 'cancel'): void;
}>();

const { dialogBind, cardClass, cardStyle, headerClass } = useSettingsDialogLayout(420);

const dialogVisible = computed({
  get: () => !!props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
});

const peerAccepted = ref(false);

watch(
  () => props.modelValue,
  (open) => {
    if (open) peerAccepted.value = false;
  },
);

function onAccept(): void {
  emit('accept');
  dialogVisible.value = false;
}

function onCancel(): void {
  emit('cancel');
  dialogVisible.value = false;
}
</script>
