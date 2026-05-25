<template>
  <q-card-section class="q-pa-md">
    <div class="row items-center q-mb-md">
      <q-btn flat round dense icon="arrow_back" @click="$emit('back')" class="q-mr-sm" />
      <span class="text-h6">{{ $text('accounts.google_config_title') }}</span>
    </div>

    <!-- Connected state -->
    <template v-if="googleAccount">
      <q-list class="rounded-borders q-mb-md">
        <q-item>
          <q-item-section avatar>
            <q-avatar>
              <img v-if="googleAccount.avatarUrl" :src="googleAccount.avatarUrl" />
              <q-icon v-else name="account_circle" size="40px" color="primary" />
            </q-avatar>
          </q-item-section>
          <q-item-section>
            <q-item-label class="text-weight-medium">{{ googleAccount.displayName }}</q-item-label>
            <q-item-label caption>{{ googleAccount.email }}</q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-btn flat dense color="negative" :label="$text('accounts.disconnect')" icon="link_off"
              @click="confirmDisconnect = true" />
          </q-item-section>
        </q-item>
      </q-list>

      <q-item-label header class="text-weight-bold q-mt-sm">
        {{ $text('accounts.google_features') }}
      </q-item-label>

      <q-list bordered separator class="rounded-borders">
        <!-- Google Auth -->
        <q-item tag="label">
          <q-item-section avatar>
            <q-icon name="verified_user" color="blue-7" size="28px" />
          </q-item-section>
          <q-item-section>
            <q-item-label>{{ $text('accounts.feature_auth') }}</q-item-label>
            <q-item-label caption>{{ $text('accounts.feature_auth_desc') }}</q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-toggle :model-value="isAuthEnabled"
              @update:model-value="(v: boolean) => $emit('toggleFeature', 'auth', v)" color="primary" />
          </q-item-section>
        </q-item>

        <!-- Google Calendar (expandable) -->
        <q-expansion-item icon="event" :label="$text('accounts.feature_calendar')"
          :caption="$text('accounts.feature_calendar_desc')" header-class="text-green-9"
          v-model="calendarExpanded">
          <template #header>
            <q-item-section avatar>
              <q-icon name="event" color="green-7" size="28px" />
            </q-item-section>
            <q-item-section>
              <q-item-label>{{ $text('accounts.feature_calendar') }}</q-item-label>
              <q-item-label caption>{{ $text('accounts.feature_calendar_desc') }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              <div class="row items-center no-wrap q-gutter-xs">
                <q-badge v-if="calendarSync.confirmed" color="positive" label="ON" />
                <q-toggle :model-value="isCalendarEnabled"
                  @update:model-value="(v: boolean) => $emit('toggleFeature', 'calendar', v)"
                  @click.stop color="green-7" />
              </div>
            </q-item-section>
          </template>

          <div v-if="isCalendarEnabled" class="q-pl-lg q-pr-md q-pb-md">
            <!-- Group picker -->
            <div class="q-mb-md">
              <div class="text-caption text-weight-medium q-mb-xs">{{ $text('accounts.calendar_group_label') }}</div>
              <q-btn outline dense no-caps
                :label="calendarGroupName || $text('accounts.calendar_group_select')"
                :icon="calendarGroupName ? 'folder' : 'add'" :color="calendarGroupName ? 'green-7' : 'grey-7'">
                <q-menu v-model="showCalendarGroupMenu" anchor="bottom left" self="top left">
                  <q-card style="min-width: 280px; max-width: 400px">
                    <GroupPicker :selected="props.googleAccount?.calendarGroupId ?? null" :show-all-groups="false"
                      max-height="40vh" @update:selected="onCalendarGroupSelect"
                      @create-group="onCalendarCreateGroup" />
                  </q-card>
                </q-menu>
              </q-btn>
            </div>

            <!-- Sync interval -->
            <div class="q-mb-md">
              <div class="text-caption text-weight-medium q-mb-xs">{{ $text('accounts.sync_interval_label') }}</div>
              <div class="row items-center q-gutter-sm">
                <q-input v-model.number="syncIntervalDraft" type="number" dense outlined
                  :min="1" :max="168" style="max-width: 100px"
                  @update:model-value="onIntervalChange" />
                <span class="text-body2 text-grey-7">{{ $text('accounts.sync_interval_unit_hours') }}</span>
              </div>
            </div>

            <!-- Last sync info -->
            <div v-if="calendarSync.lastSyncAt" class="text-caption text-grey-7 q-mb-sm">
              {{ $text('accounts.last_sync') }}: {{ formatSyncDate(calendarSync.lastSyncAt) }}
            </div>

            <!-- Confirm / Revoke sync -->
            <div>
              <q-btn v-if="!calendarSync.confirmed" unelevated color="green-7" icon="check_circle"
                :label="$text('accounts.confirm_sync')"
                :disable="!props.googleAccount?.calendarGroupId"
                @click="onConfirmAndSync" :loading="syncing" />
              <div v-else class="row items-center q-gutter-sm">
                <q-badge color="positive" class="q-pa-sm">
                  <q-icon name="check" class="q-mr-xs" size="14px" />
                  {{ $text('accounts.sync_active') }}
                </q-badge>
                <q-btn flat dense color="primary" icon="sync" :label="$text('accounts.sync_now')"
                  @click="onSyncNow" :loading="syncing" />
                <q-btn flat dense color="grey-7" :label="$text('accounts.revoke_sync')"
                  @click="$emit('revokeSync')" />
              </div>
              <div v-if="syncResult" class="text-caption q-mt-xs"
                :class="syncResult.synced ? 'text-positive' : 'text-grey-7'">
                {{ syncResult.synced
                  ? $text('accounts.sync_done').replace('{count}', String(syncResult.count))
                  : $text('accounts.sync_skipped') }}
              </div>
              <div v-if="!props.googleAccount?.calendarGroupId && !calendarSync.confirmed"
                class="text-caption text-orange-8 q-mt-xs">
                {{ $text('accounts.select_group_first') }}
              </div>
            </div>
          </div>

          <div v-else class="q-pa-md text-grey-6 text-caption">
            {{ $text('accounts.feature_calendar_desc') }}
          </div>
        </q-expansion-item>

        <!-- Google Drive (disabled) -->
        <q-item tag="label" class="text-grey-5">
          <q-item-section avatar>
            <q-icon name="cloud" color="grey-5" size="28px" />
          </q-item-section>
          <q-item-section>
            <q-item-label class="text-grey-7">{{ $text('accounts.feature_drive') }}</q-item-label>
            <q-item-label caption>{{ $text('accounts.feature_drive_desc') }}</q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-toggle :model-value="false" disable color="grey-5" />
          </q-item-section>
        </q-item>
      </q-list>
    </template>

    <!-- Not connected state -->
    <template v-else>
      <q-banner class="bg-blue-1 text-dark rounded-borders q-mb-md">
        <template v-slot:avatar>
          <q-icon name="info" color="primary" />
        </template>
        {{ $text('accounts.google_connect_info') }}
      </q-banner>

      <q-item-label header class="text-weight-bold">
        {{ $text('accounts.google_what_you_get') }}
      </q-item-label>

      <q-list bordered separator class="rounded-borders q-mb-lg">
        <q-item>
          <q-item-section avatar>
            <q-icon name="verified_user" color="blue-7" size="28px" />
          </q-item-section>
          <q-item-section>
            <q-item-label>{{ $text('accounts.feature_auth') }}</q-item-label>
            <q-item-label caption>{{ $text('accounts.feature_auth_desc') }}</q-item-label>
          </q-item-section>
        </q-item>
        <q-item>
          <q-item-section avatar>
            <q-icon name="event" color="green-7" size="28px" />
          </q-item-section>
          <q-item-section>
            <q-item-label>{{ $text('accounts.feature_calendar') }}</q-item-label>
            <q-item-label caption>{{ $text('accounts.feature_calendar_desc') }}</q-item-label>
          </q-item-section>
        </q-item>
        <q-item class="text-grey-5">
          <q-item-section avatar>
            <q-icon name="cloud" color="grey-5" size="28px" />
          </q-item-section>
          <q-item-section>
            <q-item-label class="text-grey-7">{{ $text('accounts.feature_drive') }}</q-item-label>
            <q-item-label caption>{{ $text('accounts.feature_drive_desc') }}</q-item-label>
          </q-item-section>
        </q-item>
      </q-list>

      <q-banner v-if="connectError" class="bg-red-1 text-negative rounded-borders q-mb-md">
        <template v-slot:avatar>
          <q-icon name="error" color="negative" />
        </template>
        {{ connectError }}
      </q-banner>

      <div class="text-center">
        <q-btn color="primary" icon="login" :label="$text('accounts.connect_google_btn')" @click="startGoogleConnect"
          :loading="connecting" unelevated class="q-px-lg" />
      </div>
    </template>

    <!-- Disconnect confirmation -->
    <q-dialog v-model="confirmDisconnect">
      <q-card style="min-width: 320px">
        <q-card-section>
          <div class="text-h6">{{ $text('accounts.disconnect_confirm_title') }}</div>
        </q-card-section>
        <q-card-section>
          {{ $text('accounts.disconnect_confirm_body') }}
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat :label="$text('action.cancel')" v-close-popup />
          <q-btn flat color="negative" :label="$text('accounts.disconnect')" @click="doDisconnect" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-card-section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { $text } from 'src/modules/lang';
import type { GoogleAccountLink, GoogleFeature } from '../models/UserAccount';
import { DEFAULT_CALENDAR_SYNC } from '../models/UserAccount';
import { signInWithGoogle } from '../googleAuthService';
import { runSync } from '../calendarSyncService';
import GroupPicker from 'src/modules/group/components/GroupPicker.vue';
import CC from 'src/CCAccess';

const props = defineProps<{
  googleAccount: GoogleAccountLink | null;
}>();

const emit = defineEmits<{
  (e: 'back'): void;
  (e: 'connect', link: Omit<GoogleAccountLink, 'connectedAt'>): void;
  (e: 'disconnect'): void;
  (e: 'toggleFeature', feature: GoogleFeature, enabled: boolean): void;
  (e: 'calendarGroup', groupId: string | null): void;
  (e: 'syncInterval', hours: number): void;
  (e: 'confirmSync'): void;
  (e: 'revokeSync'): void;
}>();

const confirmDisconnect = ref(false);
const connecting = ref(false);
const connectError = ref('');
const showCalendarGroupMenu = ref(false);

const isAuthEnabled = computed(() =>
  props.googleAccount?.enabledFeatures.includes('auth') ?? false,
);
const isCalendarEnabled = computed(() =>
  props.googleAccount?.enabledFeatures.includes('calendar') ?? false,
);

const calendarExpanded = ref(isCalendarEnabled.value);

watch(isCalendarEnabled, (enabled) => {
  if (enabled) calendarExpanded.value = true;
});

const calendarSync = computed(() =>
  props.googleAccount?.calendarSync ?? { ...DEFAULT_CALENDAR_SYNC },
);

const syncIntervalDraft = ref(
  props.googleAccount?.calendarSync?.intervalHours ?? DEFAULT_CALENDAR_SYNC.intervalHours,
);

function onIntervalChange(val: string | number | null) {
  const hours = Math.max(1, Math.min(168, Number(val) || 12));
  syncIntervalDraft.value = hours;
  emit('syncInterval', hours);
}

function formatSyncDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

const syncing = ref(false);
const syncResult = ref<{ synced: boolean; count: number } | null>(null);

function getSyncRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - 7);
  const to = new Date(now);
  to.setDate(to.getDate() + 21);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { from: fmt(from), to: fmt(to) };
}

async function onConfirmAndSync() {
  emit('confirmSync');
  await onSyncNow();
}

async function onSyncNow() {
  syncing.value = true;
  syncResult.value = null;
  try {
    const { from, to } = getSyncRange();
    syncResult.value = await runSync(from, to);
  } catch {
    syncResult.value = { synced: false, count: 0 };
  } finally {
    syncing.value = false;
  }
}

const calendarGroupName = computed(() => {
  const gid = props.googleAccount?.calendarGroupId;
  if (!gid) return null;
  const groups = CC.group.list.all.value || [];
  const found = groups.find((g: any) => String(g.id) === String(gid));
  return found ? String(found.name) : null;
});

function onCalendarGroupSelect(groupId: string | null) {
  showCalendarGroupMenu.value = false;
  emit('calendarGroup', groupId);
}

function onCalendarCreateGroup() {
  showCalendarGroupMenu.value = false;
  window.dispatchEvent(new CustomEvent('group:manage-edit', { detail: { groupId: null } }));
}

async function startGoogleConnect() {
  connecting.value = true;
  connectError.value = '';
  try {
    const user = await signInWithGoogle();
    emit('connect', {
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      enabledFeatures: ['auth'],
      calendarGroupId: null,
      calendarSync: { ...DEFAULT_CALENDAR_SYNC },
    });
  } catch (err) {
    connectError.value = err instanceof Error ? err.message : String(err);
  } finally {
    connecting.value = false;
  }
}

function doDisconnect() {
  emit('disconnect');
}
</script>
