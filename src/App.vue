<template>
  <div class="co21-app-root">
    <SpaceLockScreen
      v-if="spaceAuthBlocked"
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

    <template v-else>
      <router-view />
      <AppLoadProgressScreen v-if="showLoadScreen" />
    </template>
  </div>
</template>

<script setup lang="ts">
import 'src/utils/logger-shim';
import { computed, onBeforeMount, ref, watch } from 'vue';
import { $text } from 'src/modules/lang';
import SpaceLockScreen from 'src/modules/space/components/SpaceLockScreen.vue';
import MissingWorkspaceDialog from 'src/modules/space/components/MissingWorkspaceDialog.vue';
import AppLoadProgressScreen from 'src/components/AppLoadProgressScreen.vue';
import { spaceAuthBlocked, useSpaceAuth } from 'src/composables/useSpaceAuth';
import {
  finishLoadRun,
  runLoadPhase,
  showLoadScreen,
} from 'src/composables/appLoadProgress';
import {
  checkMissingWorkspace,
  clearMissingWorkspaceIssue,
  missingWorkspaceAlternatives,
  missingWorkspaceIssue,
} from 'src/composables/useMissingWorkspaceGate';

const { checked, status, verifyError, refreshStatus, submitPassword } = useSpaceAuth();

const workspaceIssue = computed(() => missingWorkspaceIssue.value);
const workspaceAlternatives = computed(() => missingWorkspaceAlternatives.value);
const hasMissingWorkspace = computed(() => !!missingWorkspaceIssue.value);

const spaceLockName = computed(() => status.value?.spaceName ?? '');
const spaceUnlockSubmitting = ref(false);
const spaceLockError = computed(() => {
  const err = verifyError.value;
  if (!err) return '';
  if (err === 'Incorrect password') return $text('space.access.incorrect_password');
  return err;
});

watch(spaceAuthBlocked, (blocked) => {
  if (blocked) finishLoadRun(false);
}, { immediate: true });

watch(hasMissingWorkspace, (missing) => {
  if (missing) finishLoadRun(false);
}, { immediate: true });

onBeforeMount(async () => {
  if (!checked.value) {
    await runLoadPhase('space_auth', () => refreshStatus());
  }
  await runLoadPhase('workspace', () => checkMissingWorkspace());
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
.co21-app-root {
  min-height: 100%;
}
</style>
