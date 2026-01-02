<template>
  <q-layout view="lHh Lpr lFf">
    <q-header elevated>
      <q-toolbar>
        <q-toolbar-title style="display:flex; align-items:center; gap:12px;">
          <div style="display:flex; align-items:center; gap:12px;">
            <span>CO21</span>
            <div class="header-today" style="display:inline-block; font-size:0.9rem; background:#0f1724; color:#2196f3; padding:8px 12px; border-radius:6px; align-items:center;">
              <div class="text-caption" style="color: #90caf9; margin-right: 8px; display:inline-block;">
                Today is <span style="color: #90caf9">{{ currentDateWeekday }},&nbsp;</span>
                <span style="color: #ffffff">{{ currentDateShort }}</span>
              </div>
              <div class="text-caption" style="color: #90caf9; margin-left: 8px; display:inline-block;">
                |&nbsp;Its <span style="color: #ffffff">{{ currentTimeDisplay }}</span> now
              </div>
            </div>
          </div>

          <div class="q-ml-md" style="display:flex; align-items:center">
            <NextEventNotification />
          </div>
        </q-toolbar-title>

        <q-chip
          :color="isOnline ? 'positive' : 'negative'"
          text-color="white"
          :icon="isOnline ? 'wifi' : 'wifi_off'"
          size="sm"
          :clickable="!isOnline"
          @click="!isOnline && updateOnlineStatus()"
        >
          {{ isOnline ? 'Online' : 'Offline' }}
        </q-chip>

        <q-btn
          v-if="!isOnline"
          flat
          dense
          color="white"
          label="Connect"
          icon="refresh"
          @click="updateOnlineStatus"
        />
        <div>v{{ $q.version }}</div>
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

onUnmounted(() => {
  window.removeEventListener('online', updateOnlineStatus);
  window.removeEventListener('offline', updateOnlineStatus);
});

// NextEventNotification component handles computation and display
</script>

<!-- styles moved to NextEventNotification.vue -->
