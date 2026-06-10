<template>

  <q-dialog :model-value="modelValue" persistent @update:model-value="onDialogUpdate">

    <q-card class="remove-workspace-confirm-card" style="min-width: 420px; max-width: 540px">

      <q-card-section>

        <div class="text-h6 remove-workspace-confirm-card__title">{{ dialogTitle }}</div>

        <p class="remove-workspace-confirm-card__intro q-mt-sm q-mb-none">

          {{ $text('space.remove_confirm_intro') }}

        </p>

      </q-card-section>



      <q-card-section class="q-pt-sm">

        <q-option-group

          v-model="removeMode"

          :options="removeModeOptions"

          type="radio"

          inline

          class="remove-workspace-options"

        />

        <div class="remove-workspace-note q-mt-md">

          {{ removeModeNote }}

        </div>

      </q-card-section>



      <q-card-actions align="right">

        <q-btn flat :label="$text('action.cancel')" @click="onDialogUpdate(false)" />

        <q-btn

          unelevated

          color="negative"

          :label="$text('space.remove_confirm_action')"

          :loading="loading"

          @click="emitConfirm"

        />

      </q-card-actions>

    </q-card>

  </q-dialog>

</template>



<script setup lang="ts">

import { computed, ref, watch } from 'vue';

import { $text } from 'src/modules/lang';



const props = defineProps<{

  modelValue: boolean;

  spaceName?: string;

  loading?: boolean;

}>();



const emit = defineEmits<{

  (e: 'update:modelValue', v: boolean): void;

  (e: 'confirm', deleteProjectFolder: boolean): void;

}>();



const removeMode = ref<'delist' | 'deleteFolder'>('delist');



const removeModeOptions = computed(() => [

  { label: $text('space.remove_option_delist'), value: 'delist' as const },

  { label: $text('space.remove_option_delete_folder'), value: 'deleteFolder' as const },

]);



const removeModeNote = computed(() =>

  removeMode.value === 'deleteFolder'

    ? $text('space.remove_option_delete_folder_note')

    : $text('space.remove_option_delist_note'),

);



const dialogTitle = computed(() =>

  $text('space.remove_confirm_title').replace('{name}', props.spaceName?.trim() || ''),

);



watch(

  () => props.modelValue,

  (open) => {

    if (open) removeMode.value = 'delist';

  },

);



function onDialogUpdate(v: boolean): void {

  emit('update:modelValue', v);

}



function emitConfirm(): void {

  emit('confirm', removeMode.value === 'deleteFolder');

}

</script>



<style scoped lang="scss">

.remove-workspace-confirm-card__title,

.remove-workspace-confirm-card__intro {

  color: inherit;

}



.remove-workspace-confirm-card__intro {

  font-size: 14px;

  line-height: 1.45;

  opacity: 0.95;

}



.remove-workspace-options {

  display: flex;

  flex-wrap: wrap;

  gap: 8px 24px;

}



.remove-workspace-options :deep(.q-radio) {

  margin: 0;

  min-height: 36px;

}



.remove-workspace-options :deep(.q-radio__label) {

  font-size: 15px;

  font-weight: 600;

  line-height: 1.3;

  color: inherit;

}



.remove-workspace-note {

  font-size: 14px;

  line-height: 1.5;

  padding: 12px 14px;

  border-radius: 8px;

  color: #1a1a1a;

  background: rgba(255, 255, 255, 0.95);

  border: 1px solid rgba(0, 0, 0, 0.12);

}



.body--dark .remove-workspace-note {

  color: #f5f5f5;

  background: rgba(0, 0, 0, 0.45);

  border-color: rgba(255, 255, 255, 0.18);

}

</style>


