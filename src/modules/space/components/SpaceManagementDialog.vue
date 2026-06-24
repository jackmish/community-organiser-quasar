<template>
  <q-dialog v-model="dialogVisible" v-bind="dialogBind">
    <q-card :class="cardClass" :style="cardStyle">
      <q-card-section :class="headerClass">
        <div class="row items-center no-wrap">
          <q-icon name="space_dashboard" size="28px" class="q-mr-sm text-primary" />
          <div class="col">
            <div class="text-h6">{{ $text('space.title') }}</div>
            <div class="text-caption text-grey-7">{{ $text('space.subtitle') }}</div>
          </div>
        </div>
      </q-card-section>

      <q-card-section :class="bodyClass" :style="bodyStyle">
        <q-banner v-if="!available" dense rounded class="bg-orange-1 text-dark q-mb-md">
          {{ $text('space.desktop_only') }}
        </q-banner>

        <q-banner v-if="isAppDataSpacesMode" dense rounded class="bg-blue-1 text-dark q-mb-md">
          {{ $text('space.app_data_hint') }}
        </q-banner>

        <template v-if="available">
          <div class="row q-col-gutter-sm q-mb-md">
            <div class="col-12 col-sm-auto">
              <q-btn
                color="primary"
                icon="add"
                :label="$text('space.create_new')"
                :disable="!!activeFormMode"
                @click="openCreateForm"
              />
            </div>
            <div v-if="!isAppDataSpacesMode" class="col-12 col-sm-auto">
              <q-btn
                outline
                color="primary"
                icon="folder_shared"
                :label="$text('space.locate_existing')"
                :disable="!!activeFormMode"
                @click="openLocateForm"
              />
            </div>
          </div>

          <q-slide-transition>
            <q-card v-if="activeFormMode === 'create'" flat bordered class="q-mb-md space-create-card">
              <q-card-section>
                <div class="text-subtitle2 q-mb-sm">{{ $text('space.create_new') }}</div>
                <q-option-group
                  v-if="!isAppDataSpacesMode"
                  v-model="createMode"
                  :options="createModeOptions"
                  type="radio"
                  inline
                  class="space-create-mode-options q-mb-sm"
                />
                <p v-if="!isAppDataSpacesMode" class="space-create-mode-hint text-body2 q-mb-md">
                  {{ createModeHint }}
                </p>
                <p v-else class="space-create-mode-hint text-body2 q-mb-md">
                  {{ $text('space.app_data_create_hint') }}
                </p>
                <q-input
                  v-model="createName"
                  dense
                  outlined
                  :label="$text('space.name_label')"
                  class="q-mb-sm"
                  @keyup.enter="submitCreate"
                />
                <div v-if="!isAppDataSpacesMode" class="row q-col-gutter-sm items-start">
                  <div class="col">
                    <q-input
                      v-model="createPath"
                      dense
                      outlined
                      readonly
                      :label="createPathLabel"
                      :hint="createPathHint"
                    />
                  </div>
                  <div class="col-auto">
                    <q-btn
                      outline
                      color="primary"
                      icon="folder_open"
                      :label="$text('space.browse')"
                      class="q-mt-xs"
                      @click="pickFolder"
                    />
                  </div>
                </div>
                <q-input
                  v-if="!isAppDataSpacesMode && createMode !== 'blank' && workspacePathPreview"
                  :model-value="workspacePathPreview"
                  dense
                  outlined
                  readonly
                  class="q-mt-sm"
                  :label="$text('space.workspace_path_label')"
                  :hint="$text('space.workspace_path_hint')"
                />
              </q-card-section>
              <q-card-actions align="right">
                <q-btn flat :label="$text('action.close')" @click="cancelForm" />
                <q-btn
                  color="primary"
                  :label="$text('action.create')"
                  :loading="creating"
                  :disable="!createName.trim() || (!isAppDataSpacesMode && !createPath.trim())"
                  @click="submitCreate"
                />
              </q-card-actions>
            </q-card>
          </q-slide-transition>

          <q-slide-transition>
            <q-card v-if="activeFormMode === 'locate'" flat bordered class="q-mb-md space-create-card">
              <q-card-section>
                <div class="text-subtitle2 q-mb-sm">{{ $text('space.locate_existing') }}</div>
                <div class="text-caption text-grey-7 q-mb-sm">{{ $text('space.locate_existing_hint') }}</div>
                <q-input
                  v-model="locateName"
                  dense
                  outlined
                  :label="$text('space.name_label')"
                  class="q-mb-sm"
                  @keyup.enter="submitLocate"
                />
                <div class="row q-col-gutter-sm items-start">
                  <div class="col">
                    <q-input
                      v-model="locatePath"
                      dense
                      outlined
                      readonly
                      :label="$text('space.path_label')"
                      :hint="$text('space.locate_path_hint')"
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
              </q-card-section>
              <q-card-actions align="right">
                <q-btn flat :label="$text('action.close')" @click="cancelForm" />
                <q-btn
                  color="primary"
                  :label="$text('space.locate_add')"
                  :loading="locating"
                  :disable="!locateName.trim() || !locatePath.trim()"
                  @click="submitLocate"
                />
              </q-card-actions>
            </q-card>
          </q-slide-transition>

          <q-slide-transition>
            <q-card v-if="activeFormMode === 'relocate'" flat bordered class="q-mb-md space-create-card">
              <q-card-section>
                <div class="text-subtitle2 q-mb-sm">{{ $text('space.locate_workspace') }}</div>
                <div class="text-caption text-grey-7 q-mb-sm">{{ $text('space.missing_locate_hint') }}</div>
                <div class="row q-col-gutter-sm items-start">
                  <div class="col">
                    <q-input
                      v-model="relocatePath"
                      dense
                      outlined
                      readonly
                      :label="$text('space.path_label')"
                      :hint="$text('space.locate_path_hint')"
                    />
                  </div>
                  <div class="col-auto">
                    <q-btn
                      outline
                      color="primary"
                      icon="folder_open"
                      :label="$text('space.browse')"
                      class="q-mt-xs"
                      @click="pickRelocateFolder"
                    />
                  </div>
                </div>
              </q-card-section>
              <q-card-actions align="right">
                <q-btn flat :label="$text('action.close')" @click="cancelForm" />
                <q-btn
                  color="primary"
                  :label="$text('space.relocate_save')"
                  :loading="relocating"
                  :disable="!relocatePath.trim() || !relocateTargetId"
                  @click="submitRelocate"
                />
              </q-card-actions>
            </q-card>
          </q-slide-transition>

          <q-slide-transition>
            <q-card v-if="activeFormMode === 'move'" flat bordered class="q-mb-md space-create-card">
              <q-card-section>
                <div class="text-subtitle2 q-mb-sm">{{ $text('space.move_workspace') }}</div>
                <div class="text-caption text-grey-7 q-mb-sm">{{ $text('space.move_hint') }}</div>
                <q-input
                  v-if="moveSourcePath"
                  :model-value="moveSourcePath"
                  dense
                  outlined
                  readonly
                  :label="$text('space.move_from_label')"
                  class="q-mb-sm"
                />
                <div class="row q-col-gutter-sm items-start">
                  <div class="col">
                    <q-input
                      v-model="moveDestPath"
                      dense
                      outlined
                      readonly
                      :label="$text('space.move_to_label')"
                      :hint="$text('space.move_dest_hint')"
                    />
                  </div>
                  <div class="col-auto">
                    <q-btn
                      outline
                      color="primary"
                      icon="folder_open"
                      :label="$text('space.browse')"
                      class="q-mt-xs"
                      @click="pickMoveFolder"
                    />
                  </div>
                </div>
              </q-card-section>
              <q-card-actions align="right">
                <q-btn flat :label="$text('action.close')" @click="cancelForm" />
                <q-btn
                  color="primary"
                  :label="$text('space.move_review')"
                  :disable="!moveDestPath.trim() || !moveTargetId"
                  @click="openMoveConfirm"
                />
              </q-card-actions>
            </q-card>
          </q-slide-transition>

          <div class="text-caption text-grey-7 q-mb-sm">
            {{ $text('space.default_space_hint') }}
          </div>

          <q-list bordered separator class="rounded-borders">
            <q-item v-for="space in spaces" :key="space.id" class="space-list-item">
              <q-item-section avatar>
                <q-avatar
                  :color="isActive(space.id) ? 'primary' : 'grey-4'"
                  :text-color="isActive(space.id) ? 'white' : 'dark'"
                  :icon="isSystemSpace(space) ? 'computer' : 'folder_shared'"
                />
              </q-item-section>
              <q-item-section>
                <q-item-label class="text-weight-medium">
                  {{ displayName(space) }}
                  <q-badge v-if="isActive(space.id)" color="primary" class="q-ml-sm">
                    {{ $text('space.active') }}
                  </q-badge>
                  <q-badge
                    v-if="isDefaultSpace(space.id) && !hasSpaceIssue(space.id)"
                    color="secondary"
                    class="q-ml-sm"
                  >
                    {{ $text('space.default_on_start') }}
                  </q-badge>
                  <q-badge
                    v-if="isDefaultSpace(space.id) && hasSpaceIssue(space.id)"
                    color="negative"
                    class="q-ml-sm"
                  >
                    {{ $text('space.default_unavailable') }}
                  </q-badge>
                  <q-badge v-if="hasSpaceIssue(space.id)" color="warning" text-color="dark" class="q-ml-sm">
                    {{ issueBadgeLabel(space.id) }}
                  </q-badge>
                </q-item-label>
                <q-item-label v-if="canShowSpaceSensitiveDetails(space)" caption>
                  {{ spaceCaption(space) }}
                </q-item-label>
                <q-item-label v-else-if="hasSpaceIssue(space.id)" caption class="text-negative">
                  {{ missingPathCaption(space.id) }}
                </q-item-label>
                <q-item-label v-else-if="!isSystemSpace(space)" caption>
                  {{ space.dataPath || '—' }}
                </q-item-label>
                <div v-if="canShowSpaceSensitiveDetails(space)" class="space-storage-mode q-mt-sm">
                  <div class="text-caption text-weight-medium q-mb-xs">
                    {{ $text('space.storage_mode') }}
                  </div>
                  <q-option-group
                    :model-value="space.storageMode"
                    :options="storageModeOptionsFor(space)"
                    type="radio"
                    dense
                    inline
                    @update:model-value="(v: SpaceStorageMode) => onStorageModeChange(space, v)"
                  />
                  <div class="text-caption text-grey-7 q-mt-xs">
                    {{
                      space.storageMode === 'sqlite'
                        ? $text('space.mode_sqlite_desc')
                        : $text('space.mode_files_desc')
                    }}
                  </div>
                  <div v-if="space.sqliteMigratedAt" class="text-caption text-positive q-mt-xs">
                    {{ $text('space.sqlite_migrated').replace('{date}', formatMigratedAt(space.sqliteMigratedAt)) }}
                  </div>
                  <q-btn
                    v-if="!space.sqliteMigratedAt"
                    flat
                    dense
                    color="primary"
                    class="q-mt-sm"
                    icon="upgrade"
                    :label="$text('space.migrate_to_sqlite')"
                    :loading="migratingId === space.id"
                    @click="runMigrate(space)"
                  />
                </div>
              </q-item-section>
              <q-item-section side top>
                <div class="column items-end q-gutter-xs space-list-item__actions">
                  <div
                    class="row items-center no-wrap"
                    :title="$text('space.default_on_start')"
                  >
                    <q-radio
                      dense
                      :model-value="defaultSpaceId"
                      :val="space.id"
                      :label="$text('space.default_space_radio')"
                      @click.stop="toggleDefaultSpace(space.id)"
                    />
                  </div>
                  <div class="row items-center no-wrap q-gutter-xs flex-wrap justify-end">
                  <q-btn
                    v-if="!isAppDataSpacesMode && !isSystemSpace(space) && hasSpaceIssue(space.id)"
                    flat
                    dense
                    color="warning"
                    icon="folder_shared"
                    :label="$text('space.locate_workspace')"
                    @click="openRelocateForm(space.id)"
                  />
                  <q-btn
                    v-if="!isSystemSpace(space)"
                    flat
                    dense
                    color="negative"
                    icon="playlist_remove"
                    :label="$text('space.remove_from_list')"
                    @click="openRemoveConfirm(space)"
                  />
                  <q-btn
                    v-if="!isAppDataSpacesMode && canMoveSpace(space)"
                    flat
                    dense
                    color="primary"
                    icon="drive_file_move"
                    :label="$text('space.move_workspace')"
                    @click="openMoveForm(space.id)"
                  />
                  <q-btn
                    v-if="isActive(space.id)"
                    flat
                    dense
                    color="primary"
                    icon="manage_accounts"
                    :label="$text('space.open_services')"
                    :title="$text('space.open_services_hint')"
                    @click="openActiveSpaceServices"
                  />
                  <q-btn
                    v-if="!isAppDataSpacesMode && canShowSpaceSensitiveDetails(space)"
                    flat
                    dense
                    round
                    icon="folder_open"
                    color="primary"
                    :title="$text('space.open_folder')"
                    :aria-label="$text('space.open_folder')"
                    @click="openFolder(space)"
                  />
                  <q-btn
                    v-if="!isActive(space.id)"
                    flat
                    dense
                    color="primary"
                    :label="$text('space.switch')"
                    @click="confirmSwitch(space)"
                  />
                  </div>
                </div>
              </q-item-section>
            </q-item>
          </q-list>
        </template>
      </q-card-section>

      <q-card-actions align="right" class="settings-dialog-footer">
        <q-btn flat :label="$text('action.close')" color="primary" @click="dialogVisible = false" />
      </q-card-actions>
    </q-card>
  </q-dialog>

  <q-dialog v-model="moveConfirmOpen" persistent>
    <q-card style="min-width: 360px; max-width: 480px">
      <q-card-section>
        <div class="text-h6">{{ $text('space.move_confirm_title') }}</div>
        <p class="q-mt-sm q-mb-sm">{{ $text('space.move_confirm_body') }}</p>
        <div class="text-caption text-grey-8 q-mb-xs">{{ $text('space.move_from_label') }}</div>
        <div class="text-body2 q-mb-sm text-weight-medium">{{ moveSourcePath }}</div>
        <div class="text-caption text-grey-8 q-mb-xs">{{ $text('space.move_to_label') }}</div>
        <div class="text-body2 text-weight-medium">{{ moveDestPath }}</div>
        <p class="text-caption text-negative q-mt-md q-mb-none">{{ $text('space.move_confirm_warning') }}</p>
      </q-card-section>
      <q-card-actions align="right">
        <q-btn flat :label="$text('action.cancel')" @click="moveConfirmOpen = false" />
        <q-btn
          color="primary"
          :label="$text('space.move_confirm_action')"
          :loading="moving"
          @click="submitMove"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>

  <q-dialog v-model="switchConfirmOpen" persistent>
    <q-card style="min-width: 320px; max-width: 420px">
      <q-card-section>
        <div class="text-h6">{{ $text('space.switch_confirm_title') }}</div>
        <p class="q-mt-sm q-mb-none">{{ $text('space.switch_confirm_body') }}</p>
        <p v-if="pendingSwitchSpace" class="q-mt-sm text-weight-medium q-mb-none">
          {{ displayName(pendingSwitchSpace) }}
        </p>
      </q-card-section>
      <q-card-actions align="right">
        <q-btn flat :label="$text('action.close')" @click="switchConfirmOpen = false" />
        <q-btn color="primary" :label="$text('space.switch')" :loading="switching" @click="doSwitch" />
      </q-card-actions>
    </q-card>
  </q-dialog>

  <RemoveWorkspaceConfirmDialog
    v-model="removeConfirmOpen"
    :space-name="removeTargetSpace ? displayName(removeTargetSpace) : ''"
    :loading="removing"
    @confirm="applyRemove"
  />
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { $text } from 'src/modules/lang';
import { useSettingsDialogLayout } from 'src/composables/useSettingsDialogLayout';
import { useSpaceAuth } from 'src/composables/useSpaceAuth';
import { appNotify } from 'src/utils/appNotify';
import {
  SYSTEM_SPACE_ID,
  browseSpaceFolder,
  CO21_WORKSPACE_DIR_NAME,
  createCustomSpace,
  createWorkspaceWithSetup,
  isSpaceAccessAvailable,
  isSpaceManagementAvailable,
  isSystemSpace,
  loadAllSpacesAccessStatus,
  loadSpaceRegistrySnapshot,
  migrateSpaceToSqlite,
  openSpaceFolder,
  registerExistingCustomSpace,
  relocateCustomSpaceFolder,
  moveCustomSpaceFolder,
  removeWorkspaceFromRegistry,
  restartAppForSpaceChanges,
  setDefaultSpace,
  setSpaceStorageMode,
  switchSpaceAndRestart,
  type SpaceEntry,
  type SpacePathIssue,
  type SpaceStorageMode,
  type WorkspaceCreateMode,
} from 'src/modules/space';
import type { OpenSpacesDialogMode } from 'src/modules/space/spaceUi';
import type { SpaceAccessStatus } from 'src/modules/space/spaceAccessModel';
import RemoveWorkspaceConfirmDialog from 'src/modules/space/components/RemoveWorkspaceConfirmDialog.vue';
import { shouldUseCapacitorStorage } from 'src/modules/storage/backend/storagePlatform';

const props = defineProps<{
  modelValue: boolean;
  initialMode?: OpenSpacesDialogMode | null;
  relocateSpaceId?: string | null;
  switchAfterRegister?: boolean;
}>();
const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
  (e: 'open-services'): void;
}>();

const { dialogBind, cardClass, cardStyle, headerClass, bodyClass, bodyStyle } =
  useSettingsDialogLayout(560, 720);

const { unlocked: spaceUnlocked } = useSpaceAuth();

const dialogVisible = ref(!!props.modelValue);
watch(
  () => props.modelValue,
  (v) => {
    dialogVisible.value = v;
  },
);
watch(dialogVisible, (v) => emit('update:modelValue', v));

const available = ref(isSpaceManagementAvailable());
const isAppDataSpacesMode = shouldUseCapacitorStorage();
const spaces = ref<SpaceEntry[]>([]);
const activeSpaceId = ref(SYSTEM_SPACE_ID);
const defaultSpaceId = ref<string | null>(null);
const defaultUserDataPath = ref('');
const spacePathIssues = ref<SpacePathIssue[]>([]);

type FormMode = 'create' | 'locate' | 'relocate' | 'move';
const activeFormMode = ref<FormMode | null>(null);
const createName = ref('');
const createPath = ref('');
const createMode = ref<WorkspaceCreateMode>('blank');
const workspacePathPreview = ref('');
const creating = ref(false);

const createModeOptions = computed(() => [
  { label: $text('space.create_mode_blank'), value: 'blank' as const },
  { label: $text('space.create_mode_folder_manager'), value: 'folder_manager' as const },
  { label: $text('space.create_mode_many_containers'), value: 'many_containers' as const },
]);

const createModeHint = computed(() => {
  switch (createMode.value) {
    case 'folder_manager':
      return $text('space.create_mode_folder_manager_hint');
    case 'many_containers':
      return $text('space.create_mode_many_containers_hint');
    default:
      return $text('space.create_mode_blank_hint');
  }
});

const createPathLabel = computed(() =>
  createMode.value === 'blank'
    ? $text('space.path_label')
    : $text('space.content_root_label'),
);

const createPathHint = computed(() =>
  createMode.value === 'blank'
    ? $text('space.path_hint')
    : $text('space.content_root_hint'),
);
const locateName = ref('');
const locatePath = ref('');
const locating = ref(false);
const relocatePath = ref('');
const relocateTargetId = ref<string | null>(null);
const relocating = ref(false);
const locateThenSwitch = ref(false);
const moveTargetId = ref<string | null>(null);
const moveDestPath = ref('');
const moveSourcePath = ref('');
const moving = ref(false);
const moveConfirmOpen = ref(false);

const switchConfirmOpen = ref(false);
const pendingSwitchSpace = ref<SpaceEntry | null>(null);
const switching = ref(false);
const removeConfirmOpen = ref(false);
const removeTargetSpace = ref<SpaceEntry | null>(null);
const removing = ref(false);
const migratingId = ref<string | null>(null);
const spaceAccessById = ref<Record<string, SpaceAccessStatus>>({});

function isSpacePasswordProtected(spaceId: string): boolean {
  const access = spaceAccessById.value[spaceId];
  return !!access?.enabled && !!access?.hasPassword;
}

function canShowSpaceSensitiveDetails(space: SpaceEntry): boolean {
  if (hasSpaceIssue(space.id)) return false;
  if (!isActive(space.id)) return false;
  if (isSpacePasswordProtected(space.id) && !spaceUnlocked.value) return false;
  return true;
}

function hasSpaceIssue(spaceId: string): boolean {
  return spacePathIssues.value.some((i) => i.spaceId === spaceId);
}

function getSpaceIssue(spaceId: string): SpacePathIssue | undefined {
  return spacePathIssues.value.find((i) => i.spaceId === spaceId);
}

function canMoveSpace(space: SpaceEntry): boolean {
  return !isSystemSpace(space) && !hasSpaceIssue(space.id);
}

function issueBadgeLabel(spaceId: string): string {
  const issue = getSpaceIssue(spaceId);
  if (issue?.kind === 'no_data') return $text('space.issue_no_data');
  return $text('space.issue_missing');
}

function missingPathCaption(spaceId: string): string {
  const issue = getSpaceIssue(spaceId);
  if (!issue) return $text('space.path_missing_short');
  if (issue.kind === 'no_data') {
    return $text('space.path_no_data_caption').replace('{path}', issue.expectedPath);
  }
  return $text('space.path_missing_caption').replace('{path}', issue.expectedPath);
}

function openActiveSpaceServices(): void {
  emit('open-services');
}

function storageModeOptionsFor(space: SpaceEntry) {
  return [
    {
      label: $text('space.mode_sqlite'),
      value: 'sqlite' as const,
      disable: !space.sqliteMigratedAt,
    },
    { label: $text('space.mode_files'), value: 'files' as const },
  ];
}

function formatMigratedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function isActive(spaceId: string): boolean {
  return activeSpaceId.value === spaceId;
}

function isDefaultSpace(spaceId: string): boolean {
  return defaultSpaceId.value === spaceId;
}

async function toggleDefaultSpace(spaceId: string): Promise<void> {
  if (defaultSpaceId.value !== spaceId && hasSpaceIssue(spaceId)) {
    appNotify('warning', $text('space.default_broken_blocked'));
    return;
  }
  const next = defaultSpaceId.value === spaceId ? null : spaceId;
  await applyDefaultSpace(next);
}

async function applyDefaultSpace(spaceId: string | null): Promise<void> {
  try {
    defaultSpaceId.value = await setDefaultSpace(spaceId);
    appNotify(
      'positive',
      spaceId ? $text('space.default_space_set') : $text('space.default_space_cleared'),
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    appNotify('negative', msg || $text('space.default_space_save_failed'));
    await refresh();
  }
}

function displayName(space: SpaceEntry): string {
  if (isSystemSpace(space)) return $text('space.system_user');
  return space.name;
}

function spaceCaption(space: SpaceEntry): string {
  if (isSystemSpace(space)) {
    const root = isAppDataSpacesMode
      ? $text('space.app_data_root')
      : defaultUserDataPath.value || '—';
    return $text('space.system_user_desc').replace('{path}', root);
  }
  if (isAppDataSpacesMode && space.dataPath) {
    return $text('space.app_data_workspace_path').replace('{path}', space.dataPath);
  }
  return space.dataPath || '—';
}

function spaceFolderPath(space: SpaceEntry): string {
  if (isSystemSpace(space)) return defaultUserDataPath.value;
  return space.dataPath?.trim() || '';
}

async function openFolder(space: SpaceEntry): Promise<void> {
  const folderPath = spaceFolderPath(space);
  if (!folderPath) {
    appNotify('warning', $text('space.open_folder_failed'));
    return;
  }
  try {
    await openSpaceFolder(folderPath);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    appNotify('negative', msg || $text('space.open_folder_failed'));
  }
}

async function refresh(): Promise<void> {
  available.value = isSpaceManagementAvailable();
  if (!available.value) return;
  const snapshot = await loadSpaceRegistrySnapshot();
  if (!snapshot) return;
  spaces.value = snapshot.registry.spaces;
  activeSpaceId.value = snapshot.registry.activeSpaceId;
  defaultSpaceId.value = snapshot.defaultSpaceId ?? snapshot.registry.defaultSpaceId ?? null;
  defaultUserDataPath.value = snapshot.defaultUserDataPath;
  spacePathIssues.value = snapshot.spacePathIssues ?? [];
  if (isSpaceAccessAvailable()) {
    spaceAccessById.value = await loadAllSpacesAccessStatus();
  } else {
    spaceAccessById.value = {};
  }
}

async function refreshWorkspacePathPreview(): Promise<void> {
  if (createMode.value === 'blank') {
    workspacePathPreview.value = '';
    return;
  }
  const root = createPath.value.trim();
  if (!root) {
    workspacePathPreview.value = '';
    return;
  }
  const api = (window as unknown as { electronAPI?: { joinPath?: (...parts: string[]) => string } })
    .electronAPI;
  workspacePathPreview.value = api?.joinPath
    ? api.joinPath(root, CO21_WORKSPACE_DIR_NAME)
    : `${root}\\${CO21_WORKSPACE_DIR_NAME}`;
}

watch([createMode, createPath], () => {
  void refreshWorkspacePathPreview();
});

function cancelForm(): void {
  activeFormMode.value = null;
  createName.value = '';
  createPath.value = '';
  createMode.value = 'blank';
  workspacePathPreview.value = '';
  locateName.value = '';
  locatePath.value = '';
  relocatePath.value = '';
  relocateTargetId.value = null;
  moveTargetId.value = null;
  moveDestPath.value = '';
  moveSourcePath.value = '';
  moveConfirmOpen.value = false;
}

function openCreateForm(): void {
  activeFormMode.value = 'create';
  createName.value = '';
  createPath.value = '';
  createMode.value = 'blank';
  workspacePathPreview.value = '';
}

function openLocateForm(): void {
  activeFormMode.value = 'locate';
  locateName.value = '';
  locatePath.value = '';
}

function openRelocateForm(spaceId: string): void {
  activeFormMode.value = 'relocate';
  relocateTargetId.value = spaceId;
  relocatePath.value = '';
}

function openMoveForm(spaceId: string): void {
  const space = spaces.value.find((s) => s.id === spaceId);
  activeFormMode.value = 'move';
  moveTargetId.value = spaceId;
  moveDestPath.value = '';
  moveSourcePath.value = space?.dataPath?.trim() || '';
}

function openMoveConfirm(): void {
  if (!moveTargetId.value || !moveDestPath.value.trim()) return;
  moveConfirmOpen.value = true;
}

function applyInitialMode(): void {
  cancelForm();
  locateThenSwitch.value = !!props.switchAfterRegister;
  const mode = props.initialMode ?? null;
  if (mode === 'create') openCreateForm();
  else if (mode === 'locate') {
    if (isAppDataSpacesMode) openCreateForm();
    else openLocateForm();
  }
  else if (mode === 'relocate' && props.relocateSpaceId) {
    openRelocateForm(props.relocateSpaceId);
  }
}

async function pickFolder(): Promise<void> {
  const folder = await browseSpaceFolder();
  if (folder) createPath.value = folder;
}

async function pickLocateFolder(): Promise<void> {
  const folder = await browseSpaceFolder();
  if (folder) locatePath.value = folder;
}

async function pickRelocateFolder(): Promise<void> {
  const folder = await browseSpaceFolder();
  if (folder) relocatePath.value = folder;
}

async function pickMoveFolder(): Promise<void> {
  const folder = await browseSpaceFolder();
  if (folder) moveDestPath.value = folder;
}

async function submitCreate(): Promise<void> {
  if (!createName.value.trim()) return;
  if (!isAppDataSpacesMode && !createPath.value.trim()) return;
  creating.value = true;
  try {
    const trimmedName = createName.value.trim();
    const trimmedPath = createPath.value.trim();
    if (isAppDataSpacesMode || createMode.value === 'blank') {
      await createCustomSpace(trimmedName, isAppDataSpacesMode ? '' : trimmedPath);
      appNotify('positive', $text('space.created_ok'));
      cancelForm();
      await refresh();
      return;
    }
    const entry = await createWorkspaceWithSetup(trimmedName, {
      mode: createMode.value,
      folderPath: trimmedPath,
    });
    appNotify('positive', $text('space.created_with_tasks_ok'));
    cancelForm();
    await switchSpaceAndRestart(entry.id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    appNotify('negative', msg || $text('space.create_failed'));
  } finally {
    creating.value = false;
  }
}

async function submitLocate(): Promise<void> {
  if (!locateName.value.trim() || !locatePath.value.trim()) return;
  locating.value = true;
  try {
    const entry = await registerExistingCustomSpace(
      locateName.value.trim(),
      locatePath.value.trim(),
    );
    appNotify('positive', $text('space.located_ok'));
    cancelForm();
    if (locateThenSwitch.value) {
      await switchSpaceAndRestart(entry.id);
      return;
    }
    await refresh();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    appNotify('negative', msg || $text('space.locate_failed'));
  } finally {
    locating.value = false;
  }
}

async function submitRelocate(): Promise<void> {
  const spaceId = relocateTargetId.value;
  if (!spaceId || !relocatePath.value.trim()) return;
  relocating.value = true;
  try {
    await relocateCustomSpaceFolder(spaceId, relocatePath.value.trim());
    appNotify('positive', $text('space.located_ok'));
    cancelForm();
    if (isActive(spaceId)) {
      await restartAppForSpaceChanges();
    } else {
      await refresh();
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    appNotify('negative', msg || $text('space.locate_failed'));
  } finally {
    relocating.value = false;
  }
}

async function submitMove(): Promise<void> {
  const spaceId = moveTargetId.value;
  if (!spaceId || !moveDestPath.value.trim()) return;
  moving.value = true;
  try {
    await moveCustomSpaceFolder(spaceId, moveDestPath.value.trim());
    appNotify('positive', $text('space.move_ok'));
    moveConfirmOpen.value = false;
    cancelForm();
    if (isActive(spaceId)) {
      await restartAppForSpaceChanges();
    } else {
      await refresh();
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    appNotify('negative', msg || $text('space.move_failed'));
  } finally {
    moving.value = false;
  }
}

async function runMigrate(space: SpaceEntry): Promise<void> {
  migratingId.value = space.id;
  try {
    const { result } = await migrateSpaceToSqlite(space.id);
    appNotify(
      'positive',
      $text('space.migrate_ok')
        .replace('{groups}', String(result.groupCount))
        .replace('{settings}', String(result.settingsKeyCount)),
    );
    await refresh();
    if (isActive(space.id)) {
      await restartAppForSpaceChanges();
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    appNotify('negative', msg || $text('space.migrate_failed'));
  } finally {
    migratingId.value = null;
  }
}

async function onStorageModeChange(space: SpaceEntry, mode: SpaceStorageMode): Promise<void> {
  if (mode === space.storageMode) return;
  if (mode === 'sqlite' && !space.sqliteMigratedAt) {
    appNotify('warning', $text('space.migrate_first'));
    return;
  }
  try {
    await setSpaceStorageMode(space.id, mode);
    await refresh();
    if (isActive(space.id)) {
      await restartAppForSpaceChanges();
    } else {
      appNotify('positive', $text('space.mode_saved'));
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    appNotify('negative', msg || $text('space.mode_save_failed'));
  }
}

function confirmSwitch(space: SpaceEntry): void {
  if (hasSpaceIssue(space.id)) {
    appNotify('warning', $text('space.switch_broken_blocked'));
    return;
  }
  pendingSwitchSpace.value = space;
  switchConfirmOpen.value = true;
}

async function doSwitch(): Promise<void> {
  if (!pendingSwitchSpace.value) return;
  switching.value = true;
  try {
    await switchSpaceAndRestart(pendingSwitchSpace.value.id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    appNotify('negative', msg || $text('space.switch_failed'));
    switching.value = false;
    switchConfirmOpen.value = false;
  }
}

function openRemoveConfirm(space: SpaceEntry): void {
  removeTargetSpace.value = space;
  removeConfirmOpen.value = true;
}

async function applyRemove(deleteProjectFolder: boolean): Promise<void> {
  if (!removeTargetSpace.value) return;
  removing.value = true;
  try {
    await removeWorkspaceFromRegistry(removeTargetSpace.value.id, {
      deleteProjectFolder,
    });
    appNotify('positive', $text('space.remove_ok'));
    removeConfirmOpen.value = false;
    removeTargetSpace.value = null;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    appNotify('negative', msg || $text('space.remove_failed'));
  } finally {
    removing.value = false;
  }
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      void refresh().then(() => applyInitialMode());
    } else {
      cancelForm();
    }
  },
);

watch(
  () => [props.initialMode, props.relocateSpaceId] as const,
  () => {
    if (dialogVisible.value) applyInitialMode();
  },
);
</script>

<style scoped>
.space-create-card {
  background: rgba(0, 0, 0, 0.02);
}

.space-create-mode-options {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 20px;
}

.space-create-mode-options :deep(.q-radio__label) {
  font-weight: 600;
}

.space-create-mode-hint {
  line-height: 1.45;
  opacity: 0.92;
}

.space-list-item {
  align-items: flex-start;
}

.space-list-item__actions {
  min-height: 40px;
}

.space-storage-mode {
  max-width: 100%;
}
</style>
