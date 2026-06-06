<template>
  <q-dialog v-model="dialogVisible" persistent maximized transition-show="slide-up" transition-hide="slide-down">
    <q-card class="accounts-dialog">
      <q-toolbar class="bg-primary text-white">
        <q-icon name="manage_accounts" size="24px" class="q-mr-sm" />
        <q-toolbar-title>{{ $text('accounts.title') }}</q-toolbar-title>
        <q-btn flat round dense icon="close" @click="dialogVisible = false" />
      </q-toolbar>

      <q-card-section v-if="!showGoogleConfig" class="q-pa-none accounts-dialog__body">
        <q-tabs
          v-model="activeTab"
          dense
          class="text-primary accounts-dialog__tabs"
          active-color="primary"
          indicator-color="primary"
          align="left"
        >
          <q-tab name="services" :label="$text('accounts.tab_services')" />
          <q-tab name="plugins" :label="$text('accounts.tab_plugins')" />
        </q-tabs>
        <q-separator />

        <q-tab-panels v-model="activeTab" animated class="accounts-dialog__panels">
          <q-tab-panel name="services" class="q-pa-md">
        <!-- CO21 Account -->
        <q-list class="rounded-borders">
          <q-item-label header class="text-weight-bold text-subtitle1">
            {{ $text('accounts.co21_section') }}
          </q-item-label>

          <q-item>
            <q-item-section avatar>
              <q-avatar color="primary" text-color="white" icon="badge" />
            </q-item-section>
            <q-item-section>
              <q-item-label>{{ $text('accounts.identifier') }}</q-item-label>
              <q-item-label caption>
                <span v-if="identifierType === 'email'">{{ identifier }}</span>
                <span v-else class="text-grey-7">{{ $text('accounts.device_id_short') }}: {{ identifierShort }}</span>
              </q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-btn flat dense color="primary" :label="$text('accounts.change_email')" @click="showEmailInput = !showEmailInput" />
            </q-item-section>
          </q-item>

          <q-item v-if="showEmailInput">
            <q-item-section avatar />
            <q-item-section>
              <q-input v-model="emailDraft" dense outlined :label="$text('accounts.email_label')" type="email"
                @keyup.enter="saveEmail">
                <template v-slot:append>
                  <q-btn flat dense round icon="check" color="positive" @click="saveEmail" :disable="!emailDraft" />
                </template>
              </q-input>
            </q-item-section>
          </q-item>

          <q-separator spaced />

          <!-- Active space access -->
          <div ref="spaceSectionAnchor">
          <q-item-label header class="text-weight-bold text-subtitle1">
            {{ $text('accounts.space_section') }}
          </q-item-label>

          <q-banner
            v-if="!spaceAccessAvailable"
            dense
            rounded
            class="bg-orange-1 text-dark q-mb-sm"
          >
            {{ $text('space.desktop_only') }}
          </q-banner>

          <template v-else>
            <q-item tag="label">
              <q-item-section avatar>
                <q-avatar color="indigo-8" text-color="white" icon="space_dashboard" />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ $text('space.access.method_password') }}</q-item-label>
                <q-item-label caption>
                  <span v-if="activeSpaceName" class="text-weight-medium">{{ activeSpaceName }}</span>
                </q-item-label>
                <q-item-label caption class="q-mt-xs">
                  {{ $text('space.access.device_local_hint') }}
                </q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-toggle
                  :model-value="spaceSimpleAuthEnabled"
                  color="primary"
                  :disable="spaceAccessSaving"
                  @update:model-value="onSimpleAuthToggle"
                />
              </q-item-section>
            </q-item>

            <q-item v-if="spaceHasPassword || showSpacePasswordForm">
              <q-item-section>
                <q-item-label caption class="q-mb-xs">
                  <q-badge
                    v-if="spaceSimpleAuthEnabled"
                    color="positive"
                    :label="$text('space.access.enabled')"
                  />
                  <q-badge
                    v-else-if="spaceHasPassword"
                    color="grey-6"
                    text-color="dark"
                    :label="$text('space.access.paused')"
                  />
                </q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-btn
                  v-if="!showSpacePasswordForm"
                  flat
                  dense
                  color="primary"
                  :label="
                    spaceHasPassword
                      ? $text('space.access.change_password')
                      : $text('space.access.set_password')
                  "
                  @click="openSpacePasswordForm"
                />
              </q-item-section>
            </q-item>

            <q-item v-if="showSpacePasswordForm">
              <q-item-section>
                <div class="space-password-form">
                <q-input
                  v-if="spaceHasPassword"
                  ref="spaceCurrentPasswordRef"
                  v-model="spaceCurrentPassword"
                  dense
                  outlined
                  class="q-mb-sm"
                  :type="showSpaceCurrent ? 'text' : 'password'"
                  :label="$text('space.access.current_password')"
                  @keyup.enter="focusSpaceNewPassword"
                >
                  <template #append>
                    <q-btn
                      flat
                      dense
                      round
                      tabindex="-1"
                      :icon="showSpaceCurrent ? 'visibility_off' : 'visibility'"
                      @click="showSpaceCurrent = !showSpaceCurrent"
                    />
                  </template>
                </q-input>
                <q-input
                  ref="spaceNewPasswordRef"
                  v-model="spaceNewPassword"
                  dense
                  outlined
                  :type="showSpaceNew ? 'text' : 'password'"
                  :label="
                    spaceHasPassword
                      ? $text('space.access.new_password')
                      : $text('space.access.password_label')
                  "
                  @keyup.enter="focusSpaceConfirmPassword"
                >
                  <template #append>
                    <q-btn
                      flat
                      dense
                      round
                      tabindex="-1"
                      :icon="showSpaceNew ? 'visibility_off' : 'visibility'"
                      @click="showSpaceNew = !showSpaceNew"
                    />
                  </template>
                </q-input>
                <q-input
                  ref="spaceConfirmPasswordRef"
                  v-model="spaceConfirmPassword"
                  dense
                  outlined
                  class="q-mt-sm"
                  :type="showSpaceConfirm ? 'text' : 'password'"
                  :label="$text('space.access.confirm_password')"
                  @keyup.enter="saveSpacePassword"
                >
                  <template #append>
                    <q-btn
                      flat
                      dense
                      round
                      tabindex="-1"
                      :icon="showSpaceConfirm ? 'visibility_off' : 'visibility'"
                      @click="showSpaceConfirm = !showSpaceConfirm"
                    />
                  </template>
                </q-input>
                <div class="q-mt-sm">
                  <q-btn
                    color="primary"
                    :label="$text('action.save')"
                    :loading="spaceAccessSaving"
                    @click="saveSpacePassword"
                  />
                </div>
                </div>
              </q-item-section>
            </q-item>

          </template>

          </div>

          <q-separator spaced />

          <!-- Google Account -->
          <q-item-label header class="text-weight-bold text-subtitle1">
            {{ $text('accounts.google_section') }}
          </q-item-label>

          <q-item clickable v-ripple @click="onGoogleClick">
            <q-item-section avatar>
              <q-avatar>
                <img v-if="googleAccount?.avatarUrl" :src="googleAccount.avatarUrl" />
                <q-icon v-else name="img:icons/google-icon.svg" size="32px"
                  style="opacity: 0.6" />
              </q-avatar>
            </q-item-section>
            <q-item-section>
              <q-item-label>Google Account</q-item-label>
              <q-item-label caption>
                <template v-if="googleAccount">
                  {{ googleAccount.displayName }} ({{ googleAccount.email }})
                </template>
                <template v-else>
                  {{ $text('accounts.google_not_connected') }}
                </template>
              </q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-badge v-if="googleAccount" color="positive" :label="$text('accounts.connected')" />
              <q-badge v-else color="grey-5" text-color="dark" :label="$text('accounts.not_configured')" />
            </q-item-section>
            <q-item-section side>
              <q-icon name="chevron_right" />
            </q-item-section>
          </q-item>

          <q-separator spaced />

          <!-- Public services (no registration) -->
          <q-item-label header class="text-weight-bold text-subtitle1">
            {{ $text('accounts.public_services_section') }}
          </q-item-label>

          <q-item tag="label">
            <q-item-section avatar>
              <q-avatar color="deep-purple-6" text-color="white" icon="celebration" />
            </q-item-section>
            <q-item-section>
              <q-item-label>{{ $text('accounts.nager_holidays_title') }}</q-item-label>
              <q-item-label caption>{{ nagerHolidaysCaption }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-toggle
                v-model="holidaySyncEnabled"
                color="deep-purple-6"
                :disable="holidaySyncSaving"
                @update:model-value="onHolidaySyncToggle"
              />
            </q-item-section>
          </q-item>

          <q-item tag="label">
            <q-item-section avatar>
              <q-avatar color="blue-grey-8" text-color="white" icon="schedule" />
            </q-item-section>
            <q-item-section>
              <q-item-label>{{ $text('accounts.clock_title') }}</q-item-label>
              <q-item-label caption>{{ clockCaption }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-toggle
                v-model="clockSyncEnabled"
                color="blue-grey-8"
                :disable="clockSyncSaving"
                @update:model-value="onClockSyncToggle"
              />
            </q-item-section>
          </q-item>

          <q-item tag="label">
            <q-item-section avatar>
              <q-avatar color="light-blue-8" text-color="white" icon="cloud" />
            </q-item-section>
            <q-item-section>
              <q-item-label>{{ $text('accounts.meteo_title') }}</q-item-label>
              <q-item-label caption>{{ meteoCaption }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-toggle
                v-model="meteoSyncEnabled"
                color="light-blue-8"
                :disable="meteoSyncSaving"
                @update:model-value="onMeteoSyncToggle"
              />
            </q-item-section>
          </q-item>
        </q-list>
          </q-tab-panel>

          <q-tab-panel name="plugins" class="q-pa-md">
            <q-list class="rounded-borders">
              <q-item tag="label">
                <q-item-section avatar>
                  <q-avatar color="teal-8" text-color="white" icon="extension" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>{{ $text('accounts.plugins_title') }}</q-item-label>
                  <q-item-label caption>{{ pluginsCaption }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-toggle
                    v-model="pluginsSyncEnabled"
                    color="teal-8"
                    :disable="pluginsSyncSaving"
                    @update:model-value="onPluginsSyncToggle"
                  />
                </q-item-section>
              </q-item>
            </q-list>
          </q-tab-panel>
        </q-tab-panels>
      </q-card-section>

      <!-- Google Config sub-view -->
      <GoogleAccountConfig v-if="showGoogleConfig" :google-account="googleAccount"
        @back="showGoogleConfig = false" @connect="onGoogleConnect" @disconnect="onGoogleDisconnect"
        @toggle-feature="onToggleFeature" @calendar-group="onCalendarGroup"
        @sync-interval="onSyncInterval" @confirm-sync="onConfirmSync" @revoke-sync="onRevokeSync" />
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import type { QInput } from 'quasar';
import { $text, getCountryCode } from 'src/modules/lang';
import { UserStoreController } from '../UserController';
import GoogleAccountConfig from './GoogleAccountConfig.vue';
import type { GoogleFeature, GoogleAccountLink } from '../models/UserAccount';
import { clearGoogleTokens } from '../googleAuthService';
import {
  loadHolidaySyncEnabled,
  saveHolidaySyncEnabled,
} from 'src/modules/time/holidaySyncSettings';
import { NAGER_HOLIDAYS_API } from 'src/modules/time/holidaySyncService';
import {
  loadClockSyncEnabled,
  saveClockSyncEnabled,
} from 'src/modules/time/clockSyncSettings';
import {
  loadMeteoSyncEnabled,
  saveMeteoSyncEnabled,
} from 'src/modules/time/meteoSyncSettings';
import {
  loadPluginsSyncEnabled,
  savePluginsSyncEnabled,
} from 'src/modules/plugins/pluginSyncSettings';
import { OPEN_METEO_FORECAST_API } from 'src/modules/time/meteoService';
import { appNotify } from 'src/utils/appNotify';
import { useSpaceAuth } from 'src/composables/useSpaceAuth';
import {
  isSpaceAccessAvailable,
  loadActiveSpaceAccessStatus,
  setActiveSpaceAccessPassword,
  setSimpleSpaceAccessEnabled,
} from 'src/modules/space/spaceAccessService';
import type { SpaceAccessStatus } from 'src/modules/space/spaceAccessModel';

const props = defineProps<{
  modelValue: boolean;
  focusSection?: 'space';
  focusSectionActive?: boolean;
}>();
const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void;
}>();

const dialogVisible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
});

const user = UserStoreController();
const { refreshStatus: refreshSpaceAuth, notifyUnlocked } = useSpaceAuth();
const spaceSectionAnchor = ref<HTMLElement | null>(null);

const showEmailInput = ref(false);
const showGoogleConfig = ref(false);
const activeTab = ref<'services' | 'plugins'>('services');
const emailDraft = ref('');

const spaceAccessAvailable = ref(isSpaceAccessAvailable());
const spaceAccessStatus = ref<SpaceAccessStatus | null>(null);
const spaceSimpleAuthEnabled = computed(() => !!spaceAccessStatus.value?.enabled);
const spaceHasPassword = computed(() => !!spaceAccessStatus.value?.hasPassword);
const spaceProtected = computed(
  () => spaceSimpleAuthEnabled.value && spaceHasPassword.value,
);
const activeSpaceName = computed(() => spaceAccessStatus.value?.spaceName ?? '');
const showSpacePasswordForm = ref(false);
const spaceCurrentPassword = ref('');
const spaceNewPassword = ref('');
const spaceConfirmPassword = ref('');
const showSpaceCurrent = ref(false);
const showSpaceNew = ref(false);
const showSpaceConfirm = ref(false);
const spaceCurrentPasswordRef = ref<QInput | null>(null);
const spaceNewPasswordRef = ref<QInput | null>(null);
const spaceConfirmPasswordRef = ref<QInput | null>(null);
const spaceAccessSaving = ref(false);
const simpleAuthToggleBusy = ref(false);
const holidaySyncEnabled = ref(true);
const holidaySyncSaving = ref(false);
const clockSyncEnabled = ref(true);
const clockSyncSaving = ref(false);
const meteoSyncEnabled = ref(false);
const meteoSyncSaving = ref(false);
const pluginsSyncEnabled = ref(false);
const pluginsSyncSaving = ref(false);

const nagerHolidaysCaption = computed(() =>
  $text('accounts.nager_holidays_desc')
    .replace('{api}', NAGER_HOLIDAYS_API)
    .replace('{country}', getCountryCode()),
);

const meteoCaption = computed(() =>
  $text('accounts.meteo_desc').replace('{api}', OPEN_METEO_FORECAST_API),
);

const clockCaption = computed(() => $text('accounts.clock_desc'));

const pluginsCaption = computed(() => $text('accounts.plugins_desc'));

const identifier = computed(() => user.identifier);
const identifierType = computed(() => user.identifierType);
const identifierShort = computed(() => {
  const id = identifier.value ?? '';
  return id.length > 12 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id;
});
const googleAccount = computed(() => user.googleAccount);

watch(dialogVisible, async (open) => {
  if (open && !user.isLoaded) {
    await user.load();
  }
  if (open) {
    holidaySyncEnabled.value = await loadHolidaySyncEnabled();
    clockSyncEnabled.value = await loadClockSyncEnabled();
    meteoSyncEnabled.value = await loadMeteoSyncEnabled();
    pluginsSyncEnabled.value = await loadPluginsSyncEnabled();
    if (spaceAccessAvailable.value) {
      spaceAccessStatus.value = await loadActiveSpaceAccessStatus();
    }
    if (props.focusSectionActive && props.focusSection === 'space') {
      activeTab.value = 'services';
      await nextTick();
      spaceSectionAnchor.value?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
  if (!open) {
    showEmailInput.value = false;
    showGoogleConfig.value = false;
    activeTab.value = 'services';
    resetSpaceAccessForm();
  }
});

async function saveEmail() {
  if (!emailDraft.value) return;
  await user.setEmail(emailDraft.value.trim());
  emailDraft.value = '';
  showEmailInput.value = false;
}

function resetSpaceAccessForm(): void {
  showSpacePasswordForm.value = false;
  spaceCurrentPassword.value = '';
  spaceNewPassword.value = '';
  spaceConfirmPassword.value = '';
  showSpaceCurrent.value = false;
  showSpaceNew.value = false;
  showSpaceConfirm.value = false;
}

function openSpacePasswordForm(): void {
  showSpacePasswordForm.value = true;
  spaceNewPassword.value = '';
  spaceConfirmPassword.value = '';
  spaceCurrentPassword.value = '';
  void nextTick(() => {
    if (spaceHasPassword.value) {
      spaceCurrentPasswordRef.value?.focus();
      return;
    }
    spaceNewPasswordRef.value?.focus();
  });
}

function focusSpaceNewPassword(): void {
  spaceNewPasswordRef.value?.focus();
}

function focusSpaceConfirmPassword(): void {
  spaceConfirmPasswordRef.value?.focus();
}

function cancelSpacePasswordForm(): void {
  showSpacePasswordForm.value = false;
  spaceNewPassword.value = '';
  spaceConfirmPassword.value = '';
  spaceCurrentPassword.value = '';
  showSpaceCurrent.value = false;
  showSpaceNew.value = false;
  showSpaceConfirm.value = false;
}

async function saveSpacePassword(): Promise<void> {
  if (!spaceNewPassword.value.trim()) {
    appNotify('warning', $text('space.access.password_required'));
    return;
  }
  if (spaceNewPassword.value !== spaceConfirmPassword.value) {
    appNotify('warning', $text('space.access.password_mismatch'));
    return;
  }
  spaceAccessSaving.value = true;
  try {
    spaceAccessStatus.value = await setActiveSpaceAccessPassword(
      spaceNewPassword.value,
      spaceHasPassword.value ? spaceCurrentPassword.value : undefined,
    );
    await refreshSpaceAuth();
    notifyUnlocked();
    appNotify('positive', $text('space.access.saved'));
    cancelSpacePasswordForm();
  } catch (e) {
    appNotify('negative', e instanceof Error ? e.message : String(e));
  } finally {
    spaceAccessSaving.value = false;
  }
}

async function onSimpleAuthToggle(enabled: boolean): Promise<void> {
  if (simpleAuthToggleBusy.value) return;
  if (enabled && !spaceHasPassword.value) {
    openSpacePasswordForm();
    return;
  }
  simpleAuthToggleBusy.value = true;
  spaceAccessSaving.value = true;
  try {
    spaceAccessStatus.value = await setSimpleSpaceAccessEnabled(enabled);
    await refreshSpaceAuth();
    notifyUnlocked();
    if (!enabled) {
      appNotify('info', $text('space.access.disabled_ok'));
    }
  } catch (e) {
    appNotify('negative', e instanceof Error ? e.message : String(e));
  } finally {
    spaceAccessSaving.value = false;
    simpleAuthToggleBusy.value = false;
  }
}

function onGoogleClick() {
  showGoogleConfig.value = true;
}

async function onGoogleConnect(link: Omit<GoogleAccountLink, 'connectedAt'>) {
  await user.connectGoogle(link);
}

async function onGoogleDisconnect() {
  await clearGoogleTokens();
  await user.disconnectGoogle();
  showGoogleConfig.value = false;
}

async function onToggleFeature(feature: GoogleFeature, enabled: boolean) {
  await user.toggleGoogleFeature(feature, enabled);
}

async function onCalendarGroup(groupId: string | null) {
  await user.setCalendarGroup(groupId);
}

async function onSyncInterval(hours: number) {
  await user.setCalendarSyncInterval(hours);
}

async function onConfirmSync() {
  await user.confirmCalendarSync();
}

async function onRevokeSync() {
  await user.revokeCalendarSync();
}

async function onHolidaySyncToggle(enabled: boolean) {
  holidaySyncSaving.value = true;
  try {
    const ok = await saveHolidaySyncEnabled(enabled);
    if (!ok) holidaySyncEnabled.value = !enabled;
  } finally {
    holidaySyncSaving.value = false;
  }
}

async function onClockSyncToggle(enabled: boolean) {
  clockSyncSaving.value = true;
  try {
    const ok = await saveClockSyncEnabled(enabled);
    if (!ok) clockSyncEnabled.value = !enabled;
  } finally {
    clockSyncSaving.value = false;
  }
}

async function onMeteoSyncToggle(enabled: boolean) {
  meteoSyncSaving.value = true;
  try {
    const ok = await saveMeteoSyncEnabled(enabled);
    if (!ok) meteoSyncEnabled.value = !enabled;
  } finally {
    meteoSyncSaving.value = false;
  }
}

async function onPluginsSyncToggle(enabled: boolean) {
  pluginsSyncSaving.value = true;
  try {
    const ok = await savePluginsSyncEnabled(enabled);
    if (!ok) pluginsSyncEnabled.value = !enabled;
  } finally {
    pluginsSyncSaving.value = false;
  }
}
</script>

<style scoped>
.accounts-dialog {
  display: flex;
  flex-direction: column;
}

.accounts-dialog__body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.accounts-dialog__tabs {
  padding: 0 12px;
}

.accounts-dialog__panels {
  flex: 1;
  min-height: 0;
}

.space-password-form {
  max-width: 360px;
  width: 100%;
}
</style>
