<template>
  <q-dialog v-model="dialogVisible" v-bind="dialogBind">
    <q-card :class="cardClass" :style="cardStyle">
      <q-card-section :class="headerClass">
        <div class="text-h6">About Community Organiser</div>
        <div class="text-subtitle2 q-mt-sm">Version {{ version }}</div>
      </q-card-section>

      <q-card-section class="q-pt-sm">
        <div>A lightweight community organiser app.</div>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Close" color="primary" @click="close" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, watchEffect } from 'vue';
import pkg from '../../../package.json';
import { useSettingsDialogLayout } from 'src/composables/useSettingsDialogLayout';

const { dialogBind, cardClass, cardStyle, headerClass } = useSettingsDialogLayout(360, 480);

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>();

const dialogVisible = ref(!!props.modelValue);
watchEffect(() => emit('update:modelValue', dialogVisible.value));

const version = ref<string>(pkg?.version || 'unknown');

function close() {
  dialogVisible.value = false as any;
}
</script>

<style scoped></style>
