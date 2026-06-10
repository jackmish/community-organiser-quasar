<template>
  <div class="co21-app-root">
    <div
      v-if="appBootPending"
      class="space-auth-boot column items-center justify-center"
    >
      <q-spinner color="primary" size="48px" />
    </div>

    <SpaceLockScreen
      v-else-if="spaceAuthBlocked"
      :space-name="spaceLockName"
      :submitting="spaceUnlockSubmitting"
      :error="spaceLockError"
      @submit="onSpaceUnlockSubmit"
    />

    <template v-else-if="hasMissingWorkspace">
      <MissingWorkspaceDialog
        :model-value="true"
        :issue="workspaceIssue"
        :alternatives="workspaceAlternatives"
        @resolved="onMissingWorkspaceResolved"
      />
    </template>

    <router-view v-else />
  </div>
</template>

<script setup lang="ts">
import 'src/utils/logger-shim';
import { computed, onBeforeMount, ref } from 'vue';
import { $text } from 'src/modules/lang';
import SpaceLockScreen from 'src/modules/space/components/SpaceLockScreen.vue';
import MissingWorkspaceDialog from 'src/modules/space/components/MissingWorkspaceDialog.vue';
import { spaceAuthBlocked, useSpaceAuth } from 'src/composables/useSpaceAuth';
import {
  checkMissingWorkspace,
  clearMissingWorkspaceIssue,
  missingWorkspaceAlternatives,
  missingWorkspaceChecked,
  missingWorkspaceIssue,
} from 'src/composables/useMissingWorkspaceGate';

const { checked, checking, status, verifyError, refreshStatus, submitPassword } = useSpaceAuth();

const workspaceIssue = computed(() => missingWorkspaceIssue.value);
const workspaceAlternatives = computed(() => missingWorkspaceAlternatives.value);
const hasMissingWorkspace = computed(() => !!missingWorkspaceIssue.value);

const appBootPending = computed(
  () => !checked.value || checking.value || !missingWorkspaceChecked.value,
);
const spaceLockName = computed(() => status.value?.spaceName ?? '');
const spaceUnlockSubmitting = ref(false);
const spaceLockError = computed(() => {
  const err = verifyError.value;
  if (!err) return '';
  if (err === 'Incorrect password') return $text('space.access.incorrect_password');
  return err;
});

onBeforeMount(async () => {
  if (!checked.value) {
    await refreshStatus();
  }
  // Re-verify at root mount (boot may have run before preload was ready, or after HMR).
  await checkMissingWorkspace();
});

function onMissingWorkspaceResolved(): void {
  clearMissingWorkspaceIssue();
}

async function onSpaceUnlockSubmit(password: string): Promise<void> {
  spaceUnlockSubmitting.value = true;
  try {
    await submitPassword(password);
  } finally {
    spaceUnlockSubmitting.value = false;
  }
}
</script>

<style scoped>
.space-auth-boot {
  position: fixed;
  inset: 0;
  z-index: 7000;
  background: var(--q-dark-page, #121212);
}
</style>
