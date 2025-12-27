<template>
  <q-layout view="lHh Lpr lFf">
    <q-header elevated>
      <q-toolbar>
        <q-toolbar-title> Community Organiser </q-toolbar-title>

        <!-- Next upcoming event notification component -->
        <NextEventNotification />

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
import { ref, onMounted, onUnmounted } from 'vue';
import NextEventNotification from '../components/NextEventNotification.vue';

const isOnline = ref(false);
let checkInterval: number | undefined;

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
