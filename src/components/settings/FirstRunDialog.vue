<template>

  <q-dialog v-model="isOpen" persistent>

    <q-card class="first-run-dialog" style="min-width: 420px; max-width: 520px">

      <q-card-section>

        <div class="text-h6">{{ $text('welcome.title') }}</div>

        <div class="text-subtitle2 q-mt-sm text-grey-8">

          {{ stepSubtitle }}

        </div>

      </q-card-section>



      <q-card-section class="q-pt-none">

        <input

          ref="fileInput"

          type="file"

          accept=".json,application/json,.zip,application/zip"

          style="display: none"

          @change="handleFileChange"

        />



        <div v-if="step === 'choose'" class="column q-gutter-sm">

          <q-btn

            unelevated

            color="primary"

            icon="rocket_launch"

            class="full-width"

            align="left"

            :label="$text('welcome.choice_new')"

            @click="step = 'new'"

          />

          <q-btn

            outline

            color="primary"

            icon="folder_shared"

            class="full-width"

            align="left"

            :label="$text('welcome.choice_existing')"

            @click="step = 'existing'"

          />

        </div>



        <div v-else-if="step === 'new'" class="column q-gutter-sm">

          <q-btn

            unelevated

            color="primary"

            icon="create_new_folder"

            class="full-width"

            align="left"

            :label="$text('welcome.create_group')"

            @click="emit('create-group')"

          />

          <q-btn

            v-if="spacesAvailable"

            outline

            color="primary"

            icon="add"

            class="full-width"

            align="left"

            :label="$text('welcome.create_workspace')"

            @click="emit('create-space')"

          />

          <q-btn flat color="grey-8" icon="arrow_back" :label="$text('welcome.back')" @click="step = 'choose'" />

        </div>



        <div v-else-if="step === 'existing'" class="column q-gutter-sm">

          <q-btn

            unelevated

            color="primary"

            icon="devices"

            class="full-width"

            align="left"

            :label="$text('welcome.open_connections')"

            @click="emit('open-connections')"

          />

          <q-btn

            v-if="spacesAvailable"

            outline

            color="primary"

            icon="folder_shared"

            class="full-width"

            align="left"

            :label="$text('welcome.locate_workspace')"

            @click="emit('locate-space')"

          />

          <q-btn

            outline

            color="secondary"

            icon="upload"

            class="full-width"

            align="left"

            :label="$text('welcome.import_backup')"

            @click="triggerImport"

          />

          <q-btn flat color="grey-8" icon="arrow_back" :label="$text('welcome.back')" @click="step = 'choose'" />

        </div>

      </q-card-section>

    </q-card>

  </q-dialog>

</template>



<script setup lang="ts">

import { computed, ref, watch } from 'vue';

import { $text } from 'src/modules/lang';



type WelcomeStep = 'choose' | 'new' | 'existing';



interface Props {

  modelValue: boolean;

  spacesAvailable?: boolean;

}



interface Emits {

  (e: 'update:modelValue', value: boolean): void;

  (e: 'create-group'): void;

  (e: 'create-space'): void;

  (e: 'locate-space'): void;

  (e: 'open-connections'): void;

  (e: 'import', file: File): void;

}



const props = withDefaults(defineProps<Props>(), {

  spacesAvailable: false,

});



const emit = defineEmits<Emits>();



const isOpen = ref(props.modelValue);

const step = ref<WelcomeStep>('choose');

const fileInput = ref<HTMLInputElement | null>(null);



watch(

  () => props.modelValue,

  (newVal) => {

    isOpen.value = newVal;

    if (newVal) step.value = 'choose';

  },

);



watch(isOpen, (newVal) => {

  emit('update:modelValue', newVal);

});



const stepSubtitle = computed(() => {

  if (step.value === 'new') return $text('welcome.subtitle_new');

  if (step.value === 'existing') return $text('welcome.subtitle_existing');

  return $text('welcome.subtitle_choose');

});



const triggerImport = () => {

  fileInput.value?.click();

};



const handleFileChange = (e: Event) => {

  const input = e.target as HTMLInputElement | null;

  const file = input?.files?.[0] ?? null;

  if (!file) return;

  emit('import', file);

  if (fileInput.value) fileInput.value.value = '';

};

</script>



<style scoped>

.first-run-dialog :deep(.q-btn) {

  justify-content: flex-start;

}

</style>


