<template>
  <div class="space-lock-screen column items-center justify-center">
    <div class="space-lock-screen__card q-pa-lg">
      <div class="column items-center q-mb-md">
        <img src="icons/co21-logo.png" alt="CO21" class="space-lock-screen__logo" />
        <div class="text-h6 q-mt-md">{{ lockHeading }}</div>
      </div>

      <p class="text-body2 text-grey-8 q-mb-md text-center">
        {{ $text('space.access.lock_hint') }}
      </p>

      <q-form @submit.prevent="onSubmit">
        <q-input
          v-model="password"
          dense
          outlined
          :type="showPassword ? 'text' : 'password'"
          :label="$text('space.access.password_label')"
          autofocus
          :error="!!error"
          :error-message="error"
          @keyup.enter="onSubmit"
        >
          <template #append>
            <q-btn
              flat
              dense
              round
              :icon="showPassword ? 'visibility_off' : 'visibility'"
              @click="showPassword = !showPassword"
            />
          </template>
        </q-input>

        <q-btn
          type="submit"
          color="primary"
          class="full-width q-mt-md"
          :label="$text('space.access.unlock')"
          :loading="submitting"
        />
      </q-form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { $text } from 'src/modules/lang';

const props = defineProps<{
  spaceName: string;
  submitting?: boolean;
  error?: string;
}>();

const emit = defineEmits<{
  (e: 'submit', password: string): void;
}>();

const lockHeading = computed(() =>
  $text('space.access.lock_title').replace('{name}', props.spaceName?.trim() || $text('space.access.lock_name_fallback')),
);

const password = ref('');
const showPassword = ref(false);

function onSubmit(): void {
  emit('submit', password.value);
}
</script>

<style scoped>
.space-lock-screen {
  position: fixed;
  inset: 0;
  z-index: 7000;
  background: var(--q-dark-page, #121212);
}

.space-lock-screen__card {
  width: min(420px, calc(100vw - 32px));
  border-radius: 12px;
  background: var(--q-card-background, #fff);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
}

.space-lock-screen__logo {
  width: 72px;
  height: 72px;
  object-fit: contain;
}
</style>
