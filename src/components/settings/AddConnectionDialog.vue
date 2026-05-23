<template>

  <q-dialog :model-value="modelValue" v-bind="dialogBind" @update:model-value="emit('update:modelValue', $event)">

    <q-card :class="cardClasses" :style="cardStyle">

      <q-card-section :class="[headerClass, 'q-pb-sm']">

        <div class="text-h6">{{ $text('connections.add_connection_title') }}</div>

      </q-card-section>



      <q-card-section class="q-pt-none q-pb-none add-connection-tabs-section">

        <!-- breakpoint=0 keeps tabs horizontal on phone (default md would stack tabs vertically on the left) -->

        <q-tabs

          v-model="tab"

          dense

          align="justify"

          active-color="primary"

          indicator-color="primary"

          class="add-connection-tabs"

          narrow-indicator

          no-caps

          :breakpoint="0"

        >

          <q-tab name="lan" icon="wifi" :label="isCompact ? undefined : $text('connections.tab_lan')" />

          <q-tab

            name="bluetooth"

            icon="bluetooth"

            :label="isCompact ? undefined : $text('connections.tab_bluetooth')"

            :disable="!bluetoothConnectionEnabled"

          />

          <q-tab

            name="internet"

            icon="cloud"

            :label="isCompact ? undefined : $text('connections.tab_internet')"

            disable

          />

        </q-tabs>

      </q-card-section>



      <div class="add-connection-scroll-body">

        <div v-if="tab === 'lan'" class="add-connection-tab-panel add-connection-tab-panel--lan">

          <LanPairingPanel

            embedded

            :active="!!modelValue"

            :own-device-name="ownDeviceName"

            v-bind="pendingOffer ? { pendingOffer } : {}"

            @paired="onLanPaired"

            @request-close="close"

          />

        </div>



        <div v-else-if="tab === 'bluetooth'" class="add-connection-tab-panel">

          <BluetoothScanPanel :active="!!modelValue" @connect="onBluetoothConnect" />

        </div>



        <div v-else class="add-connection-tab-panel">

          <div class="text-body2 add-connection-tab-panel__text">

            {{ $text('connections.internet_coming_soon') }}

          </div>

        </div>

      </div>



      <q-card-actions align="right" class="settings-dialog-footer q-pt-none">

        <q-btn flat :label="$text('connections.close')" color="primary" @click="close" />

      </q-card-actions>

    </q-card>

  </q-dialog>

</template>



<script setup lang="ts">

import { computed, ref, watch } from 'vue';

import { Capacitor } from '@capacitor/core';

import { useQuasar } from 'quasar';

import { $text } from 'src/modules/lang';

import { BLUETOOTH_CONNECTION_ENABLED } from 'src/constants/connectionFeatures';

import type { LanPendingDetail, LanPairedDevicePayload } from 'src/modules/lan/lanPairingUi';

import { useSettingsDialogLayout } from 'src/composables/useSettingsDialogLayout';

import LanPairingPanel from './LanPairingPanel.vue';

import BluetoothScanPanel from './BluetoothScanPanel.vue';



export type AddConnectionTab = 'lan' | 'bluetooth' | 'internet';



const props = withDefaults(

  defineProps<{

    modelValue: boolean;

    ownDeviceName: string;

    pendingOffer?: LanPendingDetail | null;

    initialTab?: AddConnectionTab;

  }>(),

  { initialTab: 'lan' },

);



const emit = defineEmits<{

  (e: 'update:modelValue', v: boolean): void;

  (e: 'paired', payload: LanPairedDevicePayload): void;

  (e: 'bluetooth-connect', device: { id: string; name: string }): void;

}>();



const $q = useQuasar();

const { dialogBind, cardClass, cardStyle, headerClass, isMobile } = useSettingsDialogLayout(720, 900);



/** Native app or narrow screen — horizontal tabs + stacked content. */

const isCompact = computed(

  () => isMobile.value || Capacitor.isNativePlatform() || $q.screen.width < 768,

);



const cardClasses = computed(() => [

  cardClass.value,

  'add-connection-dialog-card',

  'column',

  { 'add-connection-dialog-card--compact': isCompact.value },

]);



const bluetoothConnectionEnabled = BLUETOOTH_CONNECTION_ENABLED;

const tab = ref<AddConnectionTab>(props.initialTab);



watch(

  () => props.modelValue,

  (open) => {

    if (open) tab.value = props.initialTab;

  },

);



watch(

  () => props.initialTab,

  (t) => {

    if (props.modelValue) tab.value = t;

  },

);



function close(): void {

  emit('update:modelValue', false);

}



function onLanPaired(payload: LanPairedDevicePayload): void {

  emit('paired', payload);

  close();

}



function onBluetoothConnect(device: { id: string; name: string }): void {

  emit('bluetooth-connect', device);

  close();

}

</script>


