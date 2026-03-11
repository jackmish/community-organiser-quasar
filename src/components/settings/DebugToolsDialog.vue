<template>
  <q-dialog v-model="show">
    <q-card style="min-width: 420px">
      <q-card-section>
        <div class="text-h6">Debug tools</div>
      </q-card-section>

      <q-card-section>
        <div>
          Developer debug options will appear here. Use this dialog to expose
          quick debugging helpers (logs, export state, test actions).
        </div>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Close" @click="close" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ (e: "update:modelValue", value: boolean): void }>();

const show = computed({
  get() {
    return props.modelValue;
  },
  set(v: boolean) {
    emit("update:modelValue", v);
  },
});

function close() {
  show.value = false;
}
</script>
