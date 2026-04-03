<template>
  <q-layout view="lHh Lpr lFf">
    <q-header>
      <q-toolbar>
        <q-toolbar-title
          style="display: flex; align-items: center; gap: 12px; overflow: visible"
        >
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
                <q-menu
                  v-model="menuOpen"
                  anchor="bottom right"
                  self="top right"
                  style="width: auto"
                >
                  <q-list style="min-width: 160px">
                    <q-item style="padding: 0; position: relative">
                      <q-item-section
                        style="position: absolute; left: 0; right: 0; top: 0; padding: 0"
                      >
                        <q-select
                          style="width: 100%; position: relative"
                          class="lang-select"
                          use-input
                          hide-selected
                          fill-input
                          :input-style="{ paddingLeft: '16px', paddingRight: '16px' }"
                          popup-content-class="lang-popup"
                          ref="langSelect"
                          v-model="selectedLanguage"
                          :options="filteredLangOptions"
                          option-label="label"
                          option-value="value"
                          v-model:input-value="langFilter"
                          input-debounce="0"
                          emit-value
                          map-options
                          bg-color="blue"
                          @update:model-value="onLanguageChange"
                        >
                          <template v-slot:no-option>
                            <q-item>
                              <q-item-section class="text-grey"
                                >No results</q-item-section
                              >
                            </q-item>
                          </template>
                        </q-select>
                      </q-item-section>
                    </q-item>
                    <q-separator />
                    <q-item clickable v-ripple @click="openManageHeader">
                      <q-item-section>{{ $text("ui.manage_groups") }}</q-item-section>
                    </q-item>
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
                      <q-item-section>{{ $text("menu.connections") }}</q-item-section>
                    </q-item>
                    <q-item clickable v-ripple @click="openSettings">
                      <q-item-section>{{ $text("menu.settings") }}</q-item-section>
                    </q-item>

                    <q-item
                      clickable
                      v-ripple
                      @click="
                        () => {
                          showDebugDialog = true;
                          menuOpen = false;
                        }
                      "
                    >
                      <q-item-section>{{ $text("menu.debug_tools") }}</q-item-section>
                    </q-item>

                    <q-item clickable v-ripple @click="reloadWithTestData">
                      <q-item-section>{{
                        $text("menu.explain_features")
                      }}</q-item-section>
                    </q-item>
                    <q-item clickable v-ripple @click="openAbout">
                      <q-item-section
                        >{{ $text("menu.about") }} v{{ appVersion }}</q-item-section
                      >
                    </q-item>
                  </q-list>
                </q-menu>
              </q-btn>
            </div>
          </div>
        </q-toolbar-title>

        <AppConfigDialog v-model="showConfigDialog" />
        <ConnectionsDialog v-model="showConnectionsDialog" />
        <AboutDialog v-model="showAboutDialog" />
        <DebugToolsDialog v-model="showDebugDialog" />
      </q-toolbar>
    </q-header>

    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import "src/utils/logger-shim";
import { ref, onMounted, onUnmounted, computed, watch, nextTick } from "vue";
import { $text } from "src/modules/lang";
import { app } from "src/services/appService";
import {
  setLocale,
  detectAndSetLocale,
  changeLocale,
  loadSavedLocale,
} from "src/modules/lang";
import { langOptions } from "src/modules/lang/options";
import pkg from "../../package.json";
// Import package.json so the renderer can display the app version reliably
import { useRouter, useRoute } from "vue-router";
import NextEventNotification from "src/modules/task/components/list/NextEventNotification.vue";
import CC from "src/CCAccess";
import AppConfigDialog from "src/components/settings/AppConfigDialog.vue";
import AboutDialog from "src/components/settings/AboutDialog.vue";
import ConnectionsDialog from "src/components/settings/ConnectionsDialog.vue";
import DebugToolsDialog from "src/components/settings/DebugToolsDialog.vue";
// sample data is loaded by the presentation manager when requested
import { presentation } from "src/modules/presentation/presentationRepository";

const isOnline = ref(false);
let checkInterval: number | undefined;
const showConfigDialog = ref(false);
const showAboutDialog = ref(false);
const showConnectionsDialog = ref(false);
const showDebugDialog = ref(false);
const menuOpen = ref(false);
const selectedLanguage = ref("en-US");
const langSelect = ref<any>(null);
const filteredLangOptions = ref<any[]>([...langOptions]);
const langFilter = ref("");

// Ensure filter is cleared when menu opens so filtering starts fresh
watch(menuOpen, (val) => {
  if (val) langFilter.value = "";
});

// Update filtered options when the input value changes
watch(
  langFilter,
  (val) => {
    const q = String(val || "")
      .trim()
      .toLowerCase();
    if (!q) {
      filteredLangOptions.value = [...langOptions];
      return;
    }
    filteredLangOptions.value = (langOptions as any[]).filter((o) =>
      (o.label || "").toLowerCase().includes(q)
    );
  },
  { immediate: true }
);

// `langOptions` moved to src/modules/lang/options.ts

let headerManageHandler: any = null;
// Obtain router and route during setup (inject must run inside setup)
const router = useRouter();
const route = useRoute();
const appVersion = ref<string>(pkg?.version || "unknown");

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

async function checkInternetConnection(): Promise<boolean> {
  try {
    // Try to fetch a small resource from a reliable endpoint
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    const response = await fetch("https://www.google.com/favicon.ico", {
      method: "HEAD",
      mode: "no-cors",
      cache: "no-cache",
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
    // no-op: `DayOrganiserPage` is responsible for initial data load
  } catch (e) {
    // ignore
  }
  // Manual checks when browser detects network changes
  window.addEventListener("online", updateOnlineStatus);
  window.addEventListener("offline", () => {
    isOnline.value = false; // Immediately mark offline
  });
  // Ensure 'Manage Groups' selection in header opens the dialog in DayOrganiserPage.
  try {
    headerManageHandler = () => {
      try {
        if (route.path === "/") {
          // dispatch immediately and again after a short delay to be robust
          window.dispatchEvent(new Event("group:manage"));
          setTimeout(() => window.dispatchEvent(new Event("group:manage")), 300);
          return;
        }
        router.push("/").then(() => {
          // ensure page has a chance to mount, then dispatch
          window.dispatchEvent(new Event("group:manage"));
          setTimeout(() => window.dispatchEvent(new Event("group:manage")), 400);
        });
      } catch (e) {
        try {
          window.dispatchEvent(new Event("group:manage"));
        } catch (err) {
          // ignore
        }
      }
    };
    window.addEventListener("group:manage-request", headerManageHandler as EventListener);
    // Pull injected app version (set by main process) if available
    // appVersion is populated from preload; nothing else required
  } catch (e) {
    // ignore
  }
  // no-op: `testMode` derived from `presentation.mode` via computed
});

watch(
  () => menuOpen.value,
  (val) => {
    if (val) {
      nextTick(() => {
        try {
          if (langSelect.value && typeof langSelect.value.focus === "function") {
            langSelect.value.focus();
          }
        } catch (e) {
          // ignore
        }
      });
    }
  }
);

onMounted(async () => {
  try {
    const locale = await loadSavedLocale();
    selectedLanguage.value = locale;
  } catch (e) {
    try {
      const detected = await detectAndSetLocale();
      selectedLanguage.value = detected.locale;
    } catch (err) {
      selectedLanguage.value = "en-US";
    }
  }
});

async function onLanguageChange(lang: string) {
  try {
    await changeLocale(lang);
  } catch (e) {
    // ignore
  } finally {
    // reset filter and close menu after selection
    filteredLangOptions.value = [...langOptions];
    langFilter.value = "";
    menuOpen.value = false;
  }
}

function openSettings() {
  showConfigDialog.value = true;
  menuOpen.value = false;
}

function openManageHeader() {
  try {
    if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
      window.dispatchEvent(new Event("group:manage-request"));
    }
  } catch (e) {
    // fallback: ignore if dispatch fails
  } finally {
    menuOpen.value = false;
  }
}

function openAbout() {
  showAboutDialog.value = true;
  menuOpen.value = false;
}

async function toggleTestMode() {
  // Enable test mode only. Disallow reverting to normal mode from the UI.
  menuOpen.value = false;
  try {
    if (
      presentation &&
      typeof (presentation as any).enableTestModeWithApi === "function"
    ) {
      await (presentation as any).enableTestModeWithApi(CC);
    } else {
      presentation.toggleTestMode();
    }
  } catch (e) {
    void e;
  }
}

async function startPresentation() {
  menuOpen.value = false;
  try {
    if (
      presentation &&
      typeof (presentation as any).startPresentationWithApi === "function"
    ) {
      await (presentation as any).startPresentationWithApi(CC);
    } else {
      presentation.start();
    }
  } catch (e) {
    void e;
  }
}

async function stopPresentation() {
  menuOpen.value = false;
  try {
    if (
      presentation &&
      typeof (presentation as any).stopPresentationWithApi === "function"
    ) {
      await (presentation as any).stopPresentationWithApi(CC);
    } else {
      presentation.stop();
    }
  } catch (e) {
    void e;
  }
}

async function reloadWithTestData() {
  try {
    menuOpen.value = false;
    if (
      presentation &&
      typeof (presentation as any).enableTestModeWithApi === "function"
    ) {
      await (presentation as any).enableTestModeWithApi(CC);
    } else {
      presentation.toggleTestMode();
    }
  } catch (e) {
    void e;
  }
}

onUnmounted(() => {
  window.removeEventListener("online", updateOnlineStatus);
  window.removeEventListener("offline", updateOnlineStatus);
  try {
    if (headerManageHandler)
      window.removeEventListener(
        "group:manage-request",
        headerManageHandler as EventListener
      );
  } catch (e) {
    // ignore
  }
  // no-op: no version listeners registered
});

// NextEventNotification component handles computation and display
</script>

<style scoped>
/* Pad only the inner input/control and option text, without changing parent container background sizing */
.lang-select .q-field__control,
.lang-select .q-field__native {
  padding-left: 0 !important;
  padding-right: 0 !important;
  box-sizing: border-box;
}

/* Ensure the select's background fills the parent but inner text is padded */
.lang-select .q-field {
  background-clip: padding-box;
}
</style>
