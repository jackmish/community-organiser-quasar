<template>
  <q-layout view="lHh Lpr lFf">
    <q-header>
      <q-toolbar>
        <q-toolbar-title style="display: flex; align-items: center; gap: 12px">
          <div style="display: flex; align-items: center; gap: 12px">
            <img
              src="icons/co21-logo.png"
              alt="CO21"
              style="height: 28px; width: auto; display: inline-block"
            />
            <div style="display: flex; align-items: center">
              <GroupSelectHeader />
            </div>
          </div>

          <div class="q-ml-md" style="display: flex; align-items: center">
            <NextEventNotification />
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
      </q-toolbar>
    </q-header>

    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { format } from 'date-fns';
import NextEventNotification from '../components/NextEventNotification.vue';
import { useDayOrganiser } from '../modules/day-organiser';
import GroupSelectHeader from 'src/components/GroupSelectHeader.vue';

const isOnline = ref(false);
let checkInterval: number | undefined;
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
    // useDayOrganiser is invoked inside the notification component
    // but call load here if available via module to pre-load data
    const mod = await import('../modules/day-organiser');
    mod.useDayOrganiser?.().loadData?.();
  } catch (e) {
    // ignore
  }
  // Manual checks when browser detects network changes
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', () => {
    isOnline.value = false; // Immediately mark offline
  });
});

function refreshNotifications() {
  try {
    const mod = useDayOrganiser();
    mod?.loadData?.();
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

onUnmounted(() => {
  window.removeEventListener('online', updateOnlineStatus);
  window.removeEventListener('offline', updateOnlineStatus);
});

// NextEventNotification component handles computation and display
</script>

<!-- styles moved to NextEventNotification.vue -->
