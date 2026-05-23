<template>
  <q-dialog v-model="dialogVisible" v-bind="dialogBind">
    <q-card :class="cardClass" :style="cardStyle">
      <q-card-section :class="headerClass">
        <div class="text-h6">App Settings</div>
      </q-card-section>

      <q-card-section class="q-pt-sm" :class="bodyClass" :style="bodyStyle">
            <div class="q-gutter-md">
              <q-toggle v-model="notifications" label="Enable notifications" dense />
              <q-toggle v-model="darkMode" label="Use dark theme" dense />

            </div>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Cancel" color="primary" @click="close" />
        <q-btn flat label="Save" color="primary" @click="save" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useSettingsDialogLayout } from 'src/composables/useSettingsDialogLayout';

const { dialogBind, cardClass, cardStyle, headerClass, bodyClass, bodyStyle } =
  useSettingsDialogLayout(420, 520);

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>();

const dialogVisible = computed({
  get: () => !!props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
});

const notifications = ref(false);
const darkMode = ref(false);

onMounted(() => {
  try {
    const n = localStorage.getItem('app:notifications');
    const d = localStorage.getItem('app:darkMode');
    if (n !== null) notifications.value = n === '1';
    if (d !== null) darkMode.value = d === '1';
  } catch (e) {
    // ignore
  }
});

function close() {
  dialogVisible.value = false;
}

function save() {
  try {
    localStorage.setItem('app:notifications', notifications.value ? '1' : '0');
    localStorage.setItem('app:darkMode', darkMode.value ? '1' : '0');
  } catch (e) {
    // ignore
  }
  dialogVisible.value = false;
  try {
    window.dispatchEvent(
      new CustomEvent('app:config:changed', {
        detail: { notifications: notifications.value, darkMode: darkMode.value },
      }),
    );
  } catch (e) {
    // ignore
  }
}
</script>

<style scoped></style>
