<template>
  <q-dialog :model-value="modelValue" persistent @update:model-value="emit('update:modelValue', $event)">
    <q-card v-if="pending" style="min-width: 340px; max-width: 92vw">
      <q-card-section>
        <div class="text-h6">Confirm LAN device</div>
        <div class="text-body2 q-mt-md">
          <div><strong>Name:</strong> {{ pending.remoteName }}</div>
          <div class="q-mt-xs"><strong>Device ID:</strong> {{ pending.remoteDeviceId }}</div>
          <div v-if="pending.remoteAppVersion" class="q-mt-xs">
            <strong>App version:</strong> {{ pending.remoteAppVersion }}
          </div>
          <div v-if="pending.remoteAddress" class="q-mt-xs">
            <strong>Address:</strong> {{ pending.remoteAddress }}
          </div>
        </div>
        <div class="text-caption text-grey-7 q-mt-md">
          Only accept if you trust this device on your network.
        </div>
      </q-card-section>
      <q-card-actions align="right">
        <q-btn flat label="Decline" color="negative" @click="decline" />
        <q-btn unelevated label="Accept" color="positive" @click="accept" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import type { LanPendingDetail } from 'src/modules/lan/lanPairingUi';

const props = defineProps<{
  modelValue: boolean;
  pending: LanPendingDetail | null;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
}>();

async function accept() {
  const elan = (window as unknown as { electronLan?: { resolvePair?: (t: string, a: boolean) => Promise<unknown> } })
    .electronLan;
  if (props.pending?.token && elan?.resolvePair) {
    await elan.resolvePair(props.pending.token, true);
    window.dispatchEvent(
      new CustomEvent('co21-lan-pair-accepted', {
        detail: {
          remoteDeviceId: props.pending.remoteDeviceId,
          remoteName: props.pending.remoteName,
          remoteAddress: props.pending.remoteAddress || '',
          token: props.pending.token,
        },
      }),
    );
  }
  emit('update:modelValue', false);
}

async function decline() {
  const elan = (window as unknown as { electronLan?: { resolvePair?: (t: string, a: boolean) => Promise<unknown> } })
    .electronLan;
  if (props.pending?.token && elan?.resolvePair) {
    await elan.resolvePair(props.pending.token, false);
  }
  emit('update:modelValue', false);
}
</script>
