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

      <q-card-section>
        <div class="text-subtitle2 q-mb-sm">Data repair</div>
        <q-btn
          outline
          color="warning"
          icon="healing"
          label="Fix invalid dates"
          :loading="fixing"
          @click="runFixDates"
        />
        <div v-if="fixResult !== null" class="q-mt-sm text-caption">
          <span v-if="fixResult === 0" class="text-positive">No invalid dates found.</span>
          <span v-else class="text-warning">Fixed {{ fixResult }} date value(s). Data saved.</span>
        </div>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Close" @click="close" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import CC from "src/CentralController";
import { fixInvalidDatesInDays } from "src/utils/dateUtils";
import { saveData } from "src/utils/storageUtils";

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

const fixing = ref(false);
const fixResult = ref<number | null>(null);

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
  } catch (e) {
    fixResult.value = 0;
  } finally {
    fixing.value = false;
  }
}

function close() {
  show.value = false;
}
</script>
