<template>
  <q-dialog v-model="dialogVisible" persistent>
    <q-card style="min-width: 420px; max-width: 580px">
      <!-- Header -->
      <q-card-section class="row items-center" style="gap: 12px; padding-bottom: 8px">
        <q-icon
          :name="isReduction ? 'warning' : 'info'"
          :color="isReduction ? 'warning' : 'info'"
          size="28px"
        />
        <div class="text-h6">
          {{ isReduction ? $text('role.sync_title_reduction') : $text('role.sync_title_extension') }}
        </div>
      </q-card-section>

      <q-card-section class="q-pt-none">
        <p class="text-body2 q-mb-md" :class="isReduction ? 'text-warning' : 'text-info'">
          {{ isReduction ? $text('role.sync_intro_reduction') : $text('role.sync_intro_extension') }}
        </p>

        <!-- Change list -->
        <q-list bordered separator style="border-radius: 6px">
          <q-item v-for="(change, i) in changes" :key="i" dense>
            <q-item-section avatar style="min-width: 32px">
              <q-icon
                :name="change.changeType === 'reduction' ? 'arrow_downward' : 'arrow_upward'"
                :color="change.changeType === 'reduction' ? 'warning' : 'positive'"
                size="18px"
              />
            </q-item-section>
            <q-item-section>
              <q-item-label class="text-weight-medium">{{ change.roleName }}</q-item-label>
              <q-item-label caption>
                {{ $text('role.sync_change_from') }} <strong>{{ change.fromLabel }}</strong>
                &nbsp;→&nbsp;
                {{ $text('role.sync_change_to') }} <strong>{{ change.toLabel }}</strong>
              </q-item-label>
            </q-item-section>
          </q-item>
        </q-list>

        <!-- Double confirmation for reductions -->
        <div v-if="isReduction" class="q-mt-lg q-gutter-y-sm">
          <q-checkbox
            v-model="firstConfirm"
            :label="$text('role.sync_confirm_step1')"
            color="warning"
          />
          <transition name="fade">
            <div v-if="firstConfirm">
              <q-checkbox
                v-model="secondConfirm"
                :label="$text('role.sync_confirm_step2')"
                color="negative"
              />
            </div>
          </transition>
        </div>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat :label="$text('action.cancel')" @click="onCancel" />
        <q-btn
          v-if="isReduction"
          unelevated
          color="warning"
          text-color="white"
          :label="$text('role.sync_apply_reduction')"
          :disable="!secondConfirm"
          @click="onConfirm"
        />
        <q-btn
          v-else
          unelevated
          color="primary"
          :label="$text('role.sync_apply_extension')"
          @click="onConfirm"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { $text } from 'src/modules/lang';
import type { PrivilegeChange } from 'src/modules/storage/sync/RoleModel';

const props = defineProps<{
  modelValue: boolean;
  changes: PrivilegeChange[];
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
  (e: 'confirm'): void;
  (e: 'cancel'): void;
}>();

const dialogVisible = computed({
  get: () => !!props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
});

const isReduction = computed(() =>
  props.changes.some((c) => c.changeType === 'reduction'),
);

const firstConfirm = ref(false);
const secondConfirm = ref(false);

// Reset checkboxes each time the dialog opens
watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      firstConfirm.value = false;
      secondConfirm.value = false;
    }
  },
);

// If first confirmation is un-checked, also clear second
watch(firstConfirm, (v) => {
  if (!v) secondConfirm.value = false;
});

function onConfirm() {
  emit('confirm');
  dialogVisible.value = false;
}

function onCancel() {
  emit('cancel');
  dialogVisible.value = false;
}
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
