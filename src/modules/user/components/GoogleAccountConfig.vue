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
            <q-toggle :model-value="isAuthEnabled" @update:model-value="(v: boolean) => $emit('toggleFeature', 'auth', v)"
              color="primary" />
          </q-item-section>
        </q-item>

        <!-- Google Calendar -->
        <q-item tag="label">
          <q-item-section avatar>
            <q-icon name="event" color="green-7" size="28px" />
          </q-item-section>
          <q-item-section>
            <q-item-label>{{ $text('accounts.feature_calendar') }}</q-item-label>
            <q-item-label caption>{{ $text('accounts.feature_calendar_desc') }}</q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-toggle :model-value="isCalendarEnabled"
              @update:model-value="(v: boolean) => $emit('toggleFeature', 'calendar', v)" color="green-7" />
          </q-item-section>
        </q-item>

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

      <div class="text-center">
        <q-btn color="primary" icon="login" :label="$text('accounts.connect_google_btn')"
          @click="simulateGoogleConnect" unelevated class="q-px-lg" />
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
import { computed, ref } from 'vue';
import { $text } from 'src/modules/lang';
import type { GoogleAccountLink, GoogleFeature } from '../models/UserAccount';

const props = defineProps<{
  googleAccount: GoogleAccountLink | null;
}>();

const emit = defineEmits<{
  (e: 'back'): void;
  (e: 'connect', link: Omit<GoogleAccountLink, 'connectedAt'>): void;
  (e: 'disconnect'): void;
  (e: 'toggleFeature', feature: GoogleFeature, enabled: boolean): void;
}>();

const confirmDisconnect = ref(false);

const isAuthEnabled = computed(() =>
  props.googleAccount?.enabledFeatures.includes('auth') ?? false,
);
const isCalendarEnabled = computed(() =>
  props.googleAccount?.enabledFeatures.includes('calendar') ?? false,
);

function simulateGoogleConnect() {
  // Placeholder — real OAuth flow will replace this.
  // For now we simulate a successful connection so the UI is testable.
  emit('connect', {
    email: 'user@gmail.com',
    displayName: 'Google User',
    avatarUrl: null,
    enabledFeatures: ['auth'],
  });
}

function doDisconnect() {
  emit('disconnect');
}
</script>
