<template>
  <q-layout view="lHh Lpr lFf">
    <q-header>
      <q-toolbar>
        <q-toolbar-title style="display: flex; align-items: center; gap: 12px; overflow: visible">
          <div style="display: flex; align-items: center; gap: 12px">
            <img
              src="icons/co21-logo.png"
              alt="CO21"
              style="height: 28px; width: auto; display: inline-block"
            />
          </div>

          <div
            class="q-ml-md"
            style="
              display: flex;
              align-items: center;
              flex: 1;
              justify-content: flex-end;
              min-width: 0;
              gap: 12px;
              overflow: visible;
              position: relative;
            "
          >
            <div style="flex: 1; min-width: 0; display: flex; justify-content: flex-end">
              <NextEventNotification style="min-width: 0; width: 100%" />
            </div>
            <div style="margin-left: 12px; display: inline-block">
              <div
                class="header-today"
                style="
                  display: inline-block;
                  font-size: 0.9rem;
                  background: #ffffff;
                  color: #212121;
                  padding: 6px 10px;
                  border-radius: 6px;
                  align-items: center;
                "
              >
                <div
                  class="text-caption"
                  style="color: #424242; margin-right: 6px; display: inline-block"
                >
                  <span style="color: #757575; font-weight: 700"
                    >{{ currentDateWeekday }},&nbsp;</span
                  >
                  <span style="color: #1976d2; font-weight: 700">{{ currentDateShort }}</span>
                </div>
                <div
                  class="text-caption"
                  style="color: #424242; display: inline-block; margin-left: 6px"
                >
                  |&nbsp;<span style="color: #2e7d32; font-weight: 700">{{
                    currentTimeDisplay
                  }}</span>
                </div>
              </div>
            </div>
          </div>
        </q-toolbar-title>

        <!-- Refresh button with connection status border -->
        <q-btn
          flat
          dense
          round
          icon="refresh"
          :title="isOnline ? 'Refresh notifications (Online)' : 'Refresh notifications (Offline)'"
          :style="{
            opacity: 0.95,
            border: `2px solid var(--q-${isOnline ? 'positive' : 'negative'})`,
            borderRadius: '50%',
          }"
          @click="refreshNotifications"
        />

        <!-- Menu button (three lines) with configuration options -->
        <q-btn
          flat
          dense
          round
          icon="menu"
          color="primary"
          text-color="white"
          style="min-width: 48px; height: 100%; padding: 6px; font-size: 18px"
          title="Menu"
        >
          <q-menu v-model="menuOpen" anchor="bottom right" self="top right" style="width: auto">
            <q-list style="min-width: 160px">
              <q-item
                clickable
                v-ripple
                @click="
                  () => {
                    showConnectionsDialog = true;
                    menuOpen = false;
                  }
                "
              >
                <q-item-section>Connections and data</q-item-section>
              </q-item>
              <q-item clickable v-ripple @click="openSettings">
                <q-item-section>Settings</q-item-section>
              </q-item>
              <q-item clickable v-ripple @click="openAbout">
                <q-item-section>About v{{ appVersion }}</q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </q-btn>

        <AppConfigDialog v-model="showConfigDialog" />
        <ConnectionsDialog v-model="showConnectionsDialog" />
        <AboutDialog v-model="showAboutDialog" />
      </q-toolbar>
    </q-header>

    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import 'src/utils/logger-shim';
import { ref, onMounted, onUnmounted, computed } from 'vue';
import pkg from '../../package.json';
// Import package.json so the renderer can display the app version reliably
import { useRouter, useRoute } from 'vue-router';
import NextEventNotification from '../components/task/NextEventNotification.vue';
import { format } from 'date-fns';
import * as api from 'src/modules/day-organiser/_apiRoot';
import { useDayOrganiser } from 'src/modules/day-organiser';
import AppConfigDialog from 'src/components/settings/AppConfigDialog.vue';
import AboutDialog from 'src/components/settings/AboutDialog.vue';
import ConnectionsDialog from 'src/components/settings/ConnectionsDialog.vue';

const isOnline = ref(false);
let checkInterval: number | undefined;
const showConfigDialog = ref(false);
const showAboutDialog = ref(false);
const showConnectionsDialog = ref(false);
const menuOpen = ref(false);
let headerManageHandler: any = null;
// Obtain router and route during setup (inject must run inside setup)
const router = useRouter();
const route = useRoute();
const appVersion = ref<string>(pkg?.version || 'unknown');

const now = ref(new Date());
let clockTimer: any = null;
onMounted(() => {
  clockTimer = setInterval(() => {
    now.value = new Date();
  }, 1000);
});
onUnmounted(() => {
  if (clockTimer) clearInterval(clockTimer);
});
const currentDateWeekday = computed(() => format(now.value, 'EEEE'));
const currentDateShort = computed(() => format(now.value, 'dd.MM.yyyy'));
const currentTimeDisplay = computed(() => format(now.value, 'HH:mm'));

async function checkInternetConnection(): Promise<boolean> {
  try {
    // Try to fetch a small resource from a reliable endpoint
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    const response = await fetch('https://www.google.com/favicon.ico', {
      method: 'HEAD',
      mode: 'no-cors',
      cache: 'no-cache',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return true;
  } catch (error) {
    return false;
  }
}

function updateOnlineStatus() {
  checkInternetConnection().then((hasInternet) => {
    isOnline.value = hasInternet;
  });
}

onMounted(async () => {
  // Initial check only
  updateOnlineStatus();
  // Load organiser data so we can show upcoming event
  try {
    // ensure organiser data loaded (component will compute next event)
    // call wrapper which assigns data into the shared `api.store`
    await useDayOrganiser().loadData?.();
  } catch (e) {
    // ignore
  }
  // Manual checks when browser detects network changes
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', () => {
    isOnline.value = false; // Immediately mark offline
  });
  // Ensure 'Manage Groups' selection in header opens the dialog in DayOrganiserPage.
  try {
    headerManageHandler = () => {
      try {
        if (route.path === '/') {
          // dispatch immediately and again after a short delay to be robust
          window.dispatchEvent(new Event('group:manage'));
          setTimeout(() => window.dispatchEvent(new Event('group:manage')), 300);
          return;
        }
        router.push('/').then(() => {
          // ensure page has a chance to mount, then dispatch
          window.dispatchEvent(new Event('group:manage'));
          setTimeout(() => window.dispatchEvent(new Event('group:manage')), 400);
        });
      } catch (e) {
        try {
          window.dispatchEvent(new Event('group:manage'));
        } catch (err) {
          // ignore
        }
      }
    };
    window.addEventListener('group:manage-request', headerManageHandler as EventListener);
    // Pull injected app version (set by main process) if available
    // appVersion is populated from preload; nothing else required
  } catch (e) {
    // ignore
  }
});

function refreshNotifications() {
  try {
    useDayOrganiser().loadData?.();
    try {
      // notify pages that data was reloaded so they can refresh UI (calendar, lists)
      window.dispatchEvent(new Event('organiser:reloaded'));
    } catch (e) {
      // ignore
    }
  } catch (e) {
    // ignore
  }
}

function handleConnectionClick() {
  // trigger an immediate connection check and close menu
  updateOnlineStatus();
  menuOpen.value = false;
}

function openSettings() {
  showConfigDialog.value = true;
  menuOpen.value = false;
}

function openAbout() {
  showAboutDialog.value = true;
  menuOpen.value = false;
}

onUnmounted(() => {
  window.removeEventListener('online', updateOnlineStatus);
  window.removeEventListener('offline', updateOnlineStatus);
  try {
    if (headerManageHandler)
      window.removeEventListener('group:manage-request', headerManageHandler as EventListener);
  } catch (e) {
    // ignore
  }
  // no-op: no version listeners registered
});

// NextEventNotification component handles computation and display
</script>

<!-- styles moved to NextEventNotification.vue -->
