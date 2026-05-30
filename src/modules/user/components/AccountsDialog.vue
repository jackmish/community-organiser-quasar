<template>
  <q-dialog v-model="dialogVisible" persistent maximized transition-show="slide-up" transition-hide="slide-down">
    <q-card class="accounts-dialog">
      <q-toolbar class="bg-primary text-white">
        <q-icon name="manage_accounts" size="24px" class="q-mr-sm" />
        <q-toolbar-title>{{ $text('accounts.title') }}</q-toolbar-title>
        <q-btn flat round dense icon="close" @click="dialogVisible = false" />
      </q-toolbar>

      <q-card-section v-if="!showGoogleConfig" class="q-pa-md">
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

          <q-item>
            <q-item-section avatar>
              <q-avatar color="orange-8" text-color="white" icon="lock" />
            </q-item-section>
            <q-item-section>
              <q-item-label>{{ $text('accounts.password') }}</q-item-label>
              <q-item-label caption>
                <q-badge v-if="hasCo21Password" color="positive" :label="$text('accounts.password_set')" />
                <q-badge v-else color="grey-5" text-color="dark" :label="$text('accounts.password_not_set')" />
              </q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-btn flat dense color="primary"
                :label="hasCo21Password ? $text('accounts.change_password') : $text('accounts.set_password')"
                @click="showPasswordInput = !showPasswordInput" />
            </q-item-section>
          </q-item>

          <q-item v-if="showPasswordInput">
            <q-item-section avatar />
            <q-item-section>
              <q-input v-model="passwordDraft" dense outlined type="password"
                :label="$text('accounts.new_password')" @keyup.enter="savePassword">
                <template v-slot:append>
                  <q-btn flat dense round icon="check" color="positive" @click="savePassword"
                    :disable="!passwordDraft" />
                </template>
              </q-input>
            </q-item-section>
          </q-item>

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
        </q-list>
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
import { ref, computed, watch } from 'vue';
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

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void;
}>();

const dialogVisible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
});

const user = UserStoreController();

const showEmailInput = ref(false);
const showPasswordInput = ref(false);
const showGoogleConfig = ref(false);
const emailDraft = ref('');
const passwordDraft = ref('');
const holidaySyncEnabled = ref(true);
const holidaySyncSaving = ref(false);

const nagerHolidaysCaption = computed(() =>
  $text('accounts.nager_holidays_desc')
    .replace('{api}', NAGER_HOLIDAYS_API)
    .replace('{country}', getCountryCode()),
);

const identifier = computed(() => user.identifier);
const identifierType = computed(() => user.identifierType);
const identifierShort = computed(() => {
  const id = identifier.value ?? '';
  return id.length > 12 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id;
});
const hasCo21Password = computed(() => user.hasCo21Password);
const googleAccount = computed(() => user.googleAccount);

watch(dialogVisible, async (open) => {
  if (open && !user.isLoaded) {
    await user.load();
  }
  if (open) {
    holidaySyncEnabled.value = await loadHolidaySyncEnabled();
  }
  if (!open) {
    showEmailInput.value = false;
    showPasswordInput.value = false;
    showGoogleConfig.value = false;
  }
});

async function saveEmail() {
  if (!emailDraft.value) return;
  await user.setEmail(emailDraft.value.trim());
  emailDraft.value = '';
  showEmailInput.value = false;
}

async function savePassword() {
  if (!passwordDraft.value) return;
  const hash = await hashPassword(passwordDraft.value);
  await user.setPassword(hash);
  passwordDraft.value = '';
  showPasswordInput.value = false;
}

async function hashPassword(plain: string): Promise<string> {
  try {
    const encoded = new TextEncoder().encode(plain);
    const digest = await crypto.subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    return btoa(plain);
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
</script>

<style scoped>
.accounts-dialog {
  display: flex;
  flex-direction: column;
}
</style>
