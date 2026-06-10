<template>

  <q-dialog v-model="dialogOpen" persistent no-esc-dismiss no-backdrop-dismiss>

    <q-card class="missing-workspace-dialog">

      <q-card-section class="missing-workspace-dialog__header">

        <div class="text-h6 q-mb-sm">{{ $text('space.missing_dialog_title') }}</div>



        <p class="text-body2 text-grey-8 q-mb-sm missing-workspace-dialog__intro">

          {{ introMessage }}

        </p>

        <p class="text-body2 text-grey-8 q-mb-sm">

          {{ $text('space.missing_dialog_intro_moved') }}

        </p>

        <p class="text-body2 text-grey-8 q-mb-xs">

          {{ $text('space.missing_dialog_intro_drive') }}

        </p>



        <p class="text-caption text-grey-6 q-mb-sm missing-workspace-dialog__path">

          {{ lastLocationLabel }}

        </p>



        <p v-if="isDefaultBroken" class="text-caption text-grey-7 q-mb-sm">

          {{ defaultBrokenHint }}

        </p>



        <div class="row items-center q-gutter-sm q-mb-sm">

          <q-btn

            outline

            color="primary"

            icon="refresh"

            :label="$text('space.missing_retry')"

            :loading="busyRetry"

            :disable="busyLocate || busySkip || busyRemove"

            @click="onRetry"

          />

        </div>



        <p class="text-body2 text-grey-8 q-mb-none">

          {{ $text('space.missing_dialog_help_prompt') }}

          <button type="button" class="missing-workspace-dialog__help-link" @click="showHelp = !showHelp">

            {{ $text('space.missing_dialog_help_link') }}

          </button>.

        </p>



        <q-slide-transition>

          <div v-if="showHelp" class="missing-workspace-dialog__help q-mt-sm">

            <div class="text-subtitle2 q-mb-xs">{{ $text('space.missing_help_title') }}</div>

            <ul class="missing-workspace-dialog__help-list text-body2 text-grey-8">

              <li>{{ $text('space.missing_help_1') }}</li>

              <li>{{ $text('space.missing_help_2') }}</li>

              <li>{{ $text('space.missing_help_3') }}</li>

              <li>{{ $text('space.missing_help_4') }}</li>

            </ul>

          </div>

        </q-slide-transition>

      </q-card-section>



      <q-separator />



      <q-card-section class="q-pt-md">

        <div class="row q-col-gutter-md">

          <div class="col-12 col-lg-4">

            <div class="missing-workspace-dialog__column">

              <div class="text-subtitle1 q-mb-xs">{{ $text('space.missing_recover_title') }}</div>

              <p class="text-caption text-grey-7 q-mt-none q-mb-md">

                {{ $text('space.missing_locate_hint') }}

              </p>

              <div class="row q-col-gutter-sm items-start">

                <div class="col">

                  <q-input

                    v-model="locatePath"

                    dense

                    outlined

                    readonly

                    :label="$text('space.path_label')"

                  />

                </div>

                <div class="col-auto">

                  <q-btn

                    outline

                    color="primary"

                    icon="folder_open"

                    :label="$text('space.browse')"

                    class="q-mt-xs"

                    @click="pickLocateFolder"

                  />

                </div>

              </div>

              <q-btn

                class="q-mt-md full-width"

                unelevated

                color="primary"

                icon="folder_shared"

                :label="$text('space.locate_workspace')"

                :loading="busyLocate"

                :disable="!locatePath.trim() || busySkip || busyRetry || busyRemove"

                @click="applyLocate"

              />

            </div>

          </div>



          <div class="col-12 col-lg-4">

            <div class="missing-workspace-dialog__column missing-workspace-dialog__column--remove">

              <div class="text-subtitle1 q-mb-xs">{{ $text('space.missing_remove_title') }}</div>

              <p class="text-caption text-grey-7 q-mt-none q-mb-md">

                {{ $text('space.missing_remove_hint') }}

              </p>

              <q-btn

                class="full-width"

                outline

                color="negative"

                icon="playlist_remove"

                :label="$text('space.missing_remove_action')"

                :disable="busyLocate || busySkip || busyRetry"

                @click="showRemoveConfirm = true"

              />

            </div>

          </div>



          <div class="col-12 col-lg-4">

            <div class="missing-workspace-dialog__column missing-workspace-dialog__column--skip">

              <div class="text-subtitle1 q-mb-xs">{{ $text('space.missing_skip_now_title') }}</div>

              <p class="text-caption text-grey-7 q-mt-none q-mb-md">

                {{ $text('space.missing_skip_hint') }}

              </p>

              <q-option-group

                v-if="spaceOptions.length"

                v-model="skipSpaceId"

                :options="spaceOptions"

                type="radio"

                class="q-mb-md"

              />

              <q-btn

                class="full-width"

                outline

                color="grey-8"

                icon="skip_next"

                :label="$text('space.missing_skip_action')"

                :loading="busySkip"

                :disable="!skipSpaceId || busyLocate || busyRetry || busyRemove"

                @click="applySkip"

              />

            </div>

          </div>

        </div>

      </q-card-section>

    </q-card>

  </q-dialog>



  <RemoveWorkspaceConfirmDialog
    v-model="showRemoveConfirm"
    :space-name="props.issue?.name ?? ''"
    :loading="busyRemove"
    @confirm="applyRemove"
  />
</template>



<script setup lang="ts">

import { computed, ref, watch } from 'vue';

import { $text } from 'src/modules/lang';

import { appNotify } from 'src/utils/appNotify';

import {

  checkMissingWorkspace,

  pickDefaultAlternativeSpaceId,

} from 'src/composables/useMissingWorkspaceGate';

import {

  browseSpaceFolder,

  isSystemSpace,

  loadSpaceRegistrySnapshot,

  relocateCustomSpaceFolder,

  removeWorkspaceFromRegistry,

  restartAppForSpaceChanges,

  switchAwayFromBrokenWorkspaceAndRestart,

  type SpaceEntry,

  type SpacePathIssue,

} from 'src/modules/space';

import RemoveWorkspaceConfirmDialog from 'src/modules/space/components/RemoveWorkspaceConfirmDialog.vue';

const props = defineProps<{

  modelValue: boolean;

  issue: SpacePathIssue | null;

  alternatives: SpaceEntry[];

}>();



const emit = defineEmits<{

  (e: 'update:modelValue', v: boolean): void;

  (e: 'resolved'): void;

}>();



const dialogOpen = ref(!!props.modelValue);

const locatePath = ref('');

const skipSpaceId = ref<string | null>(null);

const busyLocate = ref(false);

const busySkip = ref(false);

const busyRetry = ref(false);

const busyRemove = ref(false);

const showHelp = ref(false);

const showRemoveConfirm = ref(false);

const defaultSpaceId = ref<string | null>(null);

watch(

  () => props.modelValue,

  (v) => {

    dialogOpen.value = v;

    if (v) void resetForm();

  },

  { immediate: true },

);



watch(dialogOpen, (v) => emit('update:modelValue', v));



const spaceOptions = computed(() =>

  props.alternatives.map((space) => ({

    label: isSystemSpace(space) ? $text('space.system_user') : space.name,

    value: space.id,

  })),

);



const introMessage = computed(() => {

  if (!props.issue) return '';

  const key =

    props.issue.kind === 'no_data'

      ? 'space.missing_dialog_intro_no_data'

      : 'space.missing_dialog_intro_missing';

  return $text(key).replace('{name}', props.issue.name);

});



const lastLocationLabel = computed(() => {

  if (!props.issue) return '';

  return $text('space.missing_dialog_last_location').replace('{path}', props.issue.expectedPath);

});



const isDefaultBroken = computed(

  () => !!props.issue && defaultSpaceId.value === props.issue.spaceId,

);



const defaultBrokenHint = computed(() => {

  if (!props.issue) return '';

  return $text('space.missing_default_broken').replace('{name}', props.issue.name);

});



async function resetForm(): Promise<void> {

  locatePath.value = '';

  showHelp.value = false;

  showRemoveConfirm.value = false;

  skipSpaceId.value = pickDefaultAlternativeSpaceId(props.alternatives);

  try {

    const snapshot = await loadSpaceRegistrySnapshot();

    defaultSpaceId.value = snapshot?.defaultSpaceId ?? null;

  } catch {

    defaultSpaceId.value = null;

  }

}



async function pickLocateFolder(): Promise<void> {

  const folder = await browseSpaceFolder();

  if (folder) locatePath.value = folder;

}



async function onRetry(): Promise<void> {

  busyRetry.value = true;

  try {

    const issue = await checkMissingWorkspace();

    if (!issue) {

      appNotify('positive', $text('space.missing_retry_ok'));

      emit('resolved');

    }

  } finally {

    busyRetry.value = false;

  }

}



async function applyLocate(): Promise<void> {

  if (!props.issue || !locatePath.value.trim()) return;

  busyLocate.value = true;

  try {

    await relocateCustomSpaceFolder(props.issue.spaceId, locatePath.value.trim());

    appNotify('positive', $text('space.located_ok'));

    emit('resolved');

    await restartAppForSpaceChanges();

  } catch (e) {

    const msg = e instanceof Error ? e.message : String(e);

    appNotify('negative', msg || $text('space.locate_failed'));

  } finally {

    busyLocate.value = false;

  }

}



async function applySkip(): Promise<void> {

  if (!skipSpaceId.value || !props.issue) return;

  busySkip.value = true;

  try {

    await switchAwayFromBrokenWorkspaceAndRestart(skipSpaceId.value, props.issue.spaceId);

    emit('resolved');

  } catch (e) {

    const msg = e instanceof Error ? e.message : String(e);

    appNotify('negative', msg || $text('space.switch_failed'));

  } finally {

    busySkip.value = false;

  }

}



async function applyRemove(deleteProjectFolder: boolean): Promise<void> {

  if (!props.issue) return;

  busyRemove.value = true;

  try {

    await removeWorkspaceFromRegistry(props.issue.spaceId, {

      deleteProjectFolder,

    });

    appNotify('positive', $text('space.remove_ok'));

    showRemoveConfirm.value = false;

    emit('resolved');

  } catch (e) {

    const msg = e instanceof Error ? e.message : String(e);

    appNotify('negative', msg || $text('space.remove_failed'));

  } finally {

    busyRemove.value = false;

  }

}

</script>



<style scoped lang="scss">

.missing-workspace-dialog {

  min-width: min(96vw, 920px);

  max-width: 980px;

}



.missing-workspace-dialog__header {

  padding-bottom: 12px;

}



.missing-workspace-dialog__intro {

  line-height: 1.5;

}



.missing-workspace-dialog__path {

  word-break: break-all;

}



.missing-workspace-dialog__help-link {

  appearance: none;

  border: none;

  padding: 0;

  margin: 0;

  background: none;

  color: var(--q-primary);

  text-decoration: underline;

  cursor: pointer;

  font: inherit;



  &:hover {

    opacity: 0.85;

  }

}



.missing-workspace-dialog__help {

  padding: 12px 14px;

  border-radius: 8px;

  background: rgba(0, 0, 0, 0.04);

}



.missing-workspace-dialog__help-list {

  margin: 0;

  padding-left: 1.2rem;



  li + li {

    margin-top: 6px;

  }

}



.missing-workspace-dialog__column {

  height: 100%;

  padding: 14px;

  border-radius: 10px;

  border: 1px solid rgba(0, 0, 0, 0.08);

  background: rgba(255, 255, 255, 0.5);

}



.missing-workspace-dialog__column--skip {

  background: rgba(0, 0, 0, 0.02);

}



.missing-workspace-dialog__column--remove {

  background: rgba(0, 0, 0, 0.015);

}



.body--dark {

  .missing-workspace-dialog__help {

    background: rgba(255, 255, 255, 0.06);

  }



  .missing-workspace-dialog__column {

    border-color: rgba(255, 255, 255, 0.12);

    background: rgba(255, 255, 255, 0.04);

  }



  .missing-workspace-dialog__column--skip,

  .missing-workspace-dialog__column--remove {

    background: rgba(0, 0, 0, 0.15);

  }

}

</style>


