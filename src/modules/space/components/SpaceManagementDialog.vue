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

        <template v-else>
          <div class="row q-mb-md">
            <q-btn
              color="primary"
              icon="add"
              :label="$text('space.create_new')"
              :disable="showCreateForm"
              @click="openCreateForm"
            />
          </div>

          <q-slide-transition>
            <q-card v-if="showCreateForm" flat bordered class="q-mb-md space-create-card">
              <q-card-section>
                <div class="text-subtitle2 q-mb-sm">{{ $text('space.create_new') }}</div>
                <q-input
                  v-model="createName"
                  dense
                  outlined
                  :label="$text('space.name_label')"
                  class="q-mb-sm"
                  @keyup.enter="submitCreate"
                />
                <div class="row q-col-gutter-sm items-start">
                  <div class="col">
                    <q-input
                      v-model="createPath"
                      dense
                      outlined
                      readonly
                      :label="$text('space.path_label')"
                      :hint="$text('space.path_hint')"
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
              </q-card-section>
              <q-card-actions align="right">
                <q-btn flat :label="$text('action.close')" @click="cancelCreate" />
                <q-btn
                  color="primary"
                  :label="$text('action.create')"
                  :loading="creating"
                  :disable="!createName.trim() || !createPath.trim()"
                  @click="submitCreate"
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
                  <q-badge v-if="isDefaultSpace(space.id)" color="secondary" class="q-ml-sm">
                    {{ $text('space.default_on_start') }}
                  </q-badge>
                </q-item-label>
                <q-item-label v-if="canShowSpaceSensitiveDetails(space)" caption>
                  {{ spaceCaption(space) }}
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
                  <div class="row items-center no-wrap q-gutter-xs">
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
                    v-if="canShowSpaceSensitiveDetails(space)"
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
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { $text } from 'src/modules/lang';
import { useSettingsDialogLayout } from 'src/composables/useSettingsDialogLayout';
import { useSpaceAuth } from 'src/composables/useSpaceAuth';
import { appNotify } from 'src/utils/appNotify';
import {
  SYSTEM_SPACE_ID,
  browseSpaceFolder,
  createCustomSpace,
  isSpaceAccessAvailable,
  isSpaceManagementAvailable,
  isSystemSpace,
  loadAllSpacesAccessStatus,
  loadSpaceRegistrySnapshot,
  migrateSpaceToSqlite,
  openSpaceFolder,
  restartAppForSpaceChanges,
  setDefaultSpace,
  setSpaceStorageMode,
  switchSpaceAndRestart,
  type SpaceEntry,
  type SpaceStorageMode,
} from 'src/modules/space';
import type { SpaceAccessStatus } from 'src/modules/space/spaceAccessModel';

const props = defineProps<{ modelValue: boolean }>();
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
const spaces = ref<SpaceEntry[]>([]);
const activeSpaceId = ref(SYSTEM_SPACE_ID);
const defaultSpaceId = ref<string | null>(null);
const defaultUserDataPath = ref('');

const showCreateForm = ref(false);
const createName = ref('');
const createPath = ref('');
const creating = ref(false);

const switchConfirmOpen = ref(false);
const pendingSwitchSpace = ref<SpaceEntry | null>(null);
const switching = ref(false);
const migratingId = ref<string | null>(null);
const spaceAccessById = ref<Record<string, SpaceAccessStatus>>({});

function isSpacePasswordProtected(spaceId: string): boolean {
  const access = spaceAccessById.value[spaceId];
  return !!access?.enabled && !!access?.hasPassword;
}

function canShowSpaceSensitiveDetails(space: SpaceEntry): boolean {
  if (!isActive(space.id)) return false;
  if (isSpacePasswordProtected(space.id) && !spaceUnlocked.value) return false;
  return true;
}

function openActiveSpaceServices(): void {
  emit('open-services');
}

function storageModeOptionsFor(space: SpaceEntry) {
  return [
    { label: $text('space.mode_files'), value: 'files' as const },
    {
      label: $text('space.mode_sqlite'),
      value: 'sqlite' as const,
      disable: !space.sqliteMigratedAt,
    },
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
    return $text('space.system_user_desc').replace('{path}', defaultUserDataPath.value || '—');
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
  if (isSpaceAccessAvailable()) {
    spaceAccessById.value = await loadAllSpacesAccessStatus();
  } else {
    spaceAccessById.value = {};
  }
}

function openCreateForm(): void {
  showCreateForm.value = true;
  createName.value = '';
  createPath.value = '';
}

function cancelCreate(): void {
  showCreateForm.value = false;
  createName.value = '';
  createPath.value = '';
}

async function pickFolder(): Promise<void> {
  const folder = await browseSpaceFolder();
  if (folder) createPath.value = folder;
}

async function submitCreate(): Promise<void> {
  if (!createName.value.trim() || !createPath.value.trim()) return;
  creating.value = true;
  try {
    await createCustomSpace(createName.value.trim(), createPath.value.trim());
    appNotify('positive', $text('space.created_ok'));
    cancelCreate();
    await refresh();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    appNotify('negative', msg || $text('space.create_failed'));
  } finally {
    creating.value = false;
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

watch(
  () => props.modelValue,
  (open) => {
    if (open) void refresh();
  },
);
</script>

<style scoped>
.space-create-card {
  background: rgba(0, 0, 0, 0.02);
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
